import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from time import time

from app.core.config import settings


@dataclass(frozen=True)
class DemoPrincipal:
    user_id: int
    role: str
    exp: int


PUBLIC_PATHS = {
    "/",
    "/api/v1/health",
    "/api/v1/auth/demo-login",
    "/api/v1/auth/demo-roles",
    "/docs",
    "/redoc",
    "/openapi.json",
}


ROLE_PERMISSIONS = {
    "mill_owner": {
        "dashboard:read",
        "cane:read",
        "production:read",
        "serial:read",
        "warehouse:read",
        "dispatch:read",
        "receipt:read",
        "exception:read",
        "audit:read",
        "roles:read",
        "settings:read",
        "demo:read",
        "demo:run",
    },
    "mill_operator": {
        "dashboard:read",
        "cane:read",
        "cane:create",
        "production:read",
        "production:create",
        "serial:read",
        "serial:activate",
        "exception:read",
        "demo:read",
        "demo:run",
    },
    "warehouse_manager": {
        "dashboard:read",
        "serial:read",
        "warehouse:read",
        "warehouse:create",
        "dispatch:read",
        "dispatch:create",
        "receipt:read",
        "receipt:create",
        "demo:read",
        "demo:run",
    },
    "fbr_officer": {
        "dashboard:read",
        "serial:read",
        "exception:read",
        "exception:review",
        "audit:read",
        "demo:read",
        "demo:run",
    },
    "government_admin": {
        "dashboard:read",
        "mill:read",
        "exception:read",
        "audit:read",
        "roles:read",
        "settings:read",
        "demo:read",
        "demo:run",
    },
    "auditor": {
        "dashboard:read",
        "serial:read",
        "exception:read",
        "exception:resolve",
        "audit:read",
        "demo:read",
        "demo:run",
    },
}


def create_demo_token(user_id: int, role: str, ttl_seconds: int = 60 * 60 * 12) -> str:
    payload = {"sub": user_id, "role": role, "exp": int(time()) + ttl_seconds}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _sign(body)
    return f"{body}.{signature}"


def decode_demo_token(token: str) -> DemoPrincipal:
    try:
        body, signature = token.split(".", 1)
    except ValueError as exc:
        raise ValueError("Malformed demo token") from exc
    expected = _sign(body)
    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid demo token signature")
    payload = json.loads(_unb64(body).decode("utf-8"))
    if int(payload["exp"]) < int(time()):
        raise ValueError("Demo token expired")
    return DemoPrincipal(user_id=int(payload["sub"]), role=str(payload["role"]), exp=int(payload["exp"]))


def permission_for_request(method: str, path: str) -> str | None:
    method = method.upper()
    if path == "/api/v1/dashboard/summary":
        return "dashboard:read"
    if path == "/api/v1/users":
        return "roles:read"
    if path.startswith("/api/v1/mills"):
        return "mill:read"
    if path.startswith("/api/v1/audit-logs"):
        return "audit:read"
    if path.startswith("/api/v1/exceptions"):
        if method == "GET":
            return "exception:read"
        return "exception:resolve"
    if path.startswith("/api/v1/cane-intakes"):
        return "cane:create" if method in {"POST", "PATCH", "DELETE"} else "cane:read"
    if path.startswith("/api/v1/production-batches"):
        return "production:create" if method in {"POST", "PATCH", "DELETE"} else "production:read"
    if path.startswith("/api/v1/packaging-serials"):
        if method == "GET":
            return "serial:read"
        return "serial:activate"
    if path.startswith("/api/v1/warehouse-receipts"):
        return "warehouse:create" if method in {"POST", "PATCH", "DELETE"} else "warehouse:read"
    if path.startswith("/api/v1/dispatches"):
        return "dispatch:create" if method in {"POST", "PATCH", "DELETE"} else "dispatch:read"
    if path.startswith("/api/v1/buyer-receipts"):
        return "receipt:create" if method in {"POST", "PATCH", "DELETE"} else "receipt:read"
    if path.startswith("/api/v1/settings"):
        return "settings:read"
    if path.startswith("/api/v1/demo"):
        return "demo:run" if method == "POST" else "demo:read"
    return None


def role_has_permission(role: str, permission: str | None) -> bool:
    permissions = ROLE_PERMISSIONS.get(role, set())
    if permission == "exception:resolve" and "exception:review" in permissions:
        return True
    return permission is None or permission in permissions


def _sign(body: str) -> str:
    digest = hmac.new(settings.demo_jwt_secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).digest()
    return _b64(digest)


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)
