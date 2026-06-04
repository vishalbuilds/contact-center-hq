import threading
import yaml
from pathlib import Path

_CONFIG: dict | None = None
_lock = threading.Lock()

_CONFIG_PATH = Path(__file__).parent.parent.parent / "auth_config.yaml"


def _load() -> dict:
    global _CONFIG
    if _CONFIG is not None:
        return _CONFIG
    with _lock:
        if _CONFIG is not None:
            return _CONFIG
        if not _CONFIG_PATH.exists():
            raise RuntimeError(f"auth_config.yaml not found at {_CONFIG_PATH}")
        with open(_CONFIG_PATH) as f:
            data = yaml.safe_load(f)
        if not isinstance(data, dict):
            raise RuntimeError(
                f"auth_config.yaml is empty or invalid — expected a mapping, got {type(data).__name__}"
            )
        _CONFIG = data
    return _CONFIG


def get_group_config(group_name: str) -> dict | None:
    """Return the config dict for a Cognito group name, or None if not recognised."""
    return _load().get("groups", {}).get(group_name)
