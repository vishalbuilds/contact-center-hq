"""
generate_test_headers.py — generates fake ALB OIDC headers for local testing.

Usage:
    python generate_test_headers.py

Paste the printed value into ModHeader (or curl -H) as:
    x-amzn-oidc-data: <value>

ModHeader URL filter: .*://localhost:8080/.*

The signature section is a dummy string — the backend does NOT verify it
(ALB is trusted to do that before forwarding). Never use these tokens against
a real ALB-protected endpoint.

To add more test users, edit the USERS list below.
Groups must match names in auth_config.yaml exactly.
"""

import base64
import json
import sys


def _b64url(data: dict) -> str:
    raw = json.dumps(data, separators=(",", ":"))
    return base64.urlsafe_b64encode(raw.encode()).rstrip(b"=").decode()


# JWT header — algorithm and key ID are ignored by the backend
_JWT_HEADER = _b64url({"alg": "ES256", "kid": "local-test", "typ": "JWT"})
_DUMMY_SIG = "localtestonly"

# ── Edit this list to add / change test users ─────────────────────────────────
# Groups must match names in auth_config.yaml exactly.
USERS = [
    {
        "label": "Admin - full access (cc-admin-all)",
        "sub": "aaaaaaaa-0000-0000-0000-000000000001",
        "cognito:username": "test.admin.all",
        "cognito:groups": ["cc-admin-all"],
        "name": "Admin Full",
        "email": "admin.all@example.com",
    },
    {
        "label": "Admin - HOO only (cc-admin-hoo)",
        "sub": "aaaaaaaa-0000-0000-0000-000000000002",
        "cognito:username": "test.admin.hoo",
        "cognito:groups": ["cc-admin-hoo"],
        "name": "Admin HOO",
        "email": "admin.hoo@example.com",
    },
    {
        "label": "Admin - Table only (cc-admin-table)",
        "sub": "aaaaaaaa-0000-0000-0000-000000000003",
        "cognito:username": "test.admin.table",
        "cognito:groups": ["cc-admin-table"],
        "name": "Admin Table",
        "email": "admin.table@example.com",
    },
    {
        "label": "Viewer - full access (cc-viewer-all)",
        "sub": "aaaaaaaa-0000-0000-0000-000000000004",
        "cognito:username": "test.viewer.all",
        "cognito:groups": ["cc-viewer-all"],
        "name": "Viewer Full",
        "email": "viewer.all@example.com",
    },
    {
        "label": "Viewer - HOO only (cc-viewer-hoo)",
        "sub": "aaaaaaaa-0000-0000-0000-000000000005",
        "cognito:username": "test.viewer.hoo",
        "cognito:groups": ["cc-viewer-hoo"],
        "name": "Viewer HOO",
        "email": "viewer.hoo@example.com",
    },
    {
        "label": "Viewer - Table only (cc-viewer-table)",
        "sub": "aaaaaaaa-0000-0000-0000-000000000006",
        "cognito:username": "test.viewer.table",
        "cognito:groups": ["cc-viewer-table"],
        "name": "Viewer Table",
        "email": "viewer.table@example.com",
    },
    {
        "label": "No group - should get 403",
        "sub": "aaaaaaaa-0000-0000-0000-000000000099",
        "cognito:username": "test.nogroup",
        "cognito:groups": [],
        "name": "Test No Group",
        "email": "nogroup@example.com",
    },
]
# ─────────────────────────────────────────────────────────────────────────────


def _make_token(user: dict) -> str:
    claims = {
        "sub": user["sub"],
        "cognito:username": user["cognito:username"],
        "cognito:groups": user["cognito:groups"],
        "name": user["name"],
        "email": user["email"],
        "iat": 1700000000,
        "exp": 9999999999,
    }
    return f"{_JWT_HEADER}.{_b64url(claims)}.{_DUMMY_SIG}"


def main() -> None:
    filter_label = " ".join(sys.argv[1:]).lower()

    for user in USERS:
        if filter_label and filter_label not in user["label"].lower():
            continue
        token = _make_token(user)
        print("-" * 60)
        print(f"  {user['label']}")
        print("-" * 60)
        print(f"  Header : x-amzn-oidc-data")
        print(f"  Value  : {token}")
        print()


if __name__ == "__main__":
    main()
