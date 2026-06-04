import base64
import json
import logging
import os

from fastapi import Depends, HTTPException, Request

from auth.v1.config import get_group_config
from auth.v1.models import User

logger = logging.getLogger(__name__)


def _decode_alb_payload(token: str) -> dict:
    """
    Base64-decode the payload section of the ALB-injected OIDC JWT.
    No signature verification needed — ALB authenticated the user before
    forwarding the request; the container is not directly reachable.
    """
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed JWT")
    padded = parts[1] + "=" * (-len(parts[1]) % 4)
    return json.loads(base64.urlsafe_b64decode(padded))


def _build_user(group: str, cfg: dict, claims: dict | None = None) -> User:
    """
    Construct a User from a matched group config and (optionally) JWT claims.
    Validates that resources is a non-empty list and access_level is recognised.
    """
    resources = cfg.get("resources")
    if not isinstance(resources, list):
        raise RuntimeError(
            f"Group '{group}' in auth_config.yaml has invalid or missing 'resources' "
            f"(got {type(resources).__name__}). Expected a list."
        )
    access_level = cfg.get("access_level", "")
    if access_level not in ("admin", "viewer"):
        raise RuntimeError(
            f"Group '{group}' has unrecognised access_level '{access_level}'. "
            "Must be 'admin' or 'viewer'."
        )
    if claims:
        # ── PROVIDER: JWT claim keys ──────────────────────────────────────────
        # These keys are specific to the identity provider injecting the JWT.
        # When switching providers (e.g. Cognito → Microsoft Entra ID / Azure AD),
        # update ONLY this block — the rest of the codebase uses the normalised
        # User model and does not need to change.
        #
        # Cognito (current):
        #   username  → "cognito:username"  (falls back to "preferred_username", "sub")
        #   full name → "name"
        #   email     → "email"
        #   groups    → "cognito:groups"  (see get_current_user below)
        #
        # Microsoft Entra ID (future, likely keys):
        #   username  → "preferred_username" or "upn"
        #   full name → "name"
        #   email     → "email" or "preferred_username"
        #   groups    → "groups" (object IDs) — update get_current_user too
        # ─────────────────────────────────────────────────────────────────────
        username = (
            claims.get("cognito:username")
            or claims.get("preferred_username")
            or claims.get("sub", "")
        )
        return User(
            username=username,
            name=claims.get("name", ""),
            email=claims.get("email", ""),
            group=group,
            access_level=access_level,
            resources=resources,
        )
    return User(
        username="dev-user",
        name="Dev User",
        email="dev@local",
        group=group,
        access_level=access_level,
        resources=resources,
    )


async def get_current_user(request: Request) -> User:
    """
    Resolve the authenticated User from the x-amzn-oidc-data header injected
    by ALB after Cognito authentication.

    DEV_USER_GROUP: set to a group name from auth_config.yaml to bypass
    header parsing when running locally without ALB in front.
    WARNING: never set this variable in production deployments.
    """
    dev_group = os.getenv("DEV_USER_GROUP")
    if dev_group:
        logger.warning(
            "DEV_USER_GROUP is set — authentication is bypassed. "
            "This must NOT be used in production."
        )
        dev_cfg = get_group_config(dev_group)
        if not dev_cfg:
            raise HTTPException(500, f"DEV_USER_GROUP '{dev_group}' not found in auth_config.yaml")
        try:
            return _build_user(dev_group, dev_cfg)
        except RuntimeError as exc:
            raise HTTPException(500, str(exc)) from exc

    # ── PROVIDER: inbound token header ───────────────────────────────────────
    # AWS ALB injects the OIDC identity token as "x-amzn-oidc-data".
    # When switching to a different proxy or IdP (e.g. Microsoft Entra ID via
    # App Gateway, or a custom OIDC proxy), update the header name here and, if
    # necessary, replace _decode_alb_payload with a provider-specific decoder
    # (e.g. one that performs full signature verification).
    # ─────────────────────────────────────────────────────────────────────────
    oidc_data = request.headers.get("x-amzn-oidc-data")
    if not oidc_data:
        raise HTTPException(401, "Not authenticated")

    try:
        claims = _decode_alb_payload(oidc_data)
    except Exception:
        logger.exception("Failed to decode x-amzn-oidc-data header")
        raise HTTPException(401, "Invalid auth token")

    # ── PROVIDER: group membership claim ─────────────────────────────────────
    # Cognito embeds group membership in "cognito:groups" as a list of strings.
    # Microsoft Entra ID uses "groups" (UUIDs) or "roles" (app-role names).
    # Update the claim key and matching logic in auth_config.yaml group names
    # to match whatever the new provider sends.
    # ─────────────────────────────────────────────────────────────────────────
    # Pick the highest-privilege recognised group: admin beats viewer.
    groups: list[str] = claims.get("cognito:groups", [])
    best_group: str | None = None
    best_cfg: dict | None = None

    for g in groups:
        c = get_group_config(g)
        if not c:
            continue
        if best_cfg is None:
            best_group, best_cfg = g, c
        elif c.get("access_level") == "admin" and best_cfg.get("access_level") != "admin":
            # Prefer admin over viewer when the user belongs to both.
            best_group, best_cfg = g, c

    if best_group is None or best_cfg is None:
        raise HTTPException(403, "No recognised group assigned — contact your administrator")

    try:
        return _build_user(best_group, best_cfg, claims)
    except RuntimeError as exc:
        logger.error("Auth config error for group '%s': %s", best_group, exc)
        raise HTTPException(500, "Server configuration error — contact your administrator") from exc


# ── Permission guards ─────────────────────────────────────────────────────────

def require_table_read(user: User = Depends(get_current_user)) -> User:
    if not user.can_read("table"):
        raise HTTPException(403, "Table access not permitted for your group")
    return user


def require_table_write(user: User = Depends(get_current_user)) -> User:
    if not user.can_write("table"):
        raise HTTPException(403, "Table write access not permitted for your group")
    return user


def require_hoo_read(user: User = Depends(get_current_user)) -> User:
    if not user.can_read("hoo"):
        raise HTTPException(403, "HOO access not permitted for your group")
    return user


def require_hoo_write(user: User = Depends(get_current_user)) -> User:
    if not user.can_write("hoo"):
        raise HTTPException(403, "HOO write access not permitted for your group")
    return user
