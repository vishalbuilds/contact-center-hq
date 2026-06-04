from fastapi import APIRouter, Depends

from auth.v1.dependencies import get_current_user
from auth.v1.models import User

me_router = APIRouter()


@me_router.get("/profile")
async def get_profile(user: User = Depends(get_current_user)):
    """Return the current user's identity and permissions (used by the frontend on load)."""
    return {
        "username": user.username,
        "name": user.name,
        "email": user.email,
        "group": user.group,
        "accessLevel": user.access_level,
        "resources": user.resources,
    }
