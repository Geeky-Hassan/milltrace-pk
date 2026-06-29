from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.database import Base, SessionLocal, engine
from app.db.seed import seed_database
from app.domain import DomainError
from app.security import PUBLIC_PATHS, decode_demo_token, permission_for_request, role_has_permission


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="MillTrace PK API",
    description="Traceability and anti-diversion API for Pakistan sugar mills.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.middleware("http")
async def demo_auth_middleware(request: Request, call_next):
    path = request.url.path.rstrip("/") or "/"
    if path in PUBLIC_PATHS or path.startswith("/docs") or path.startswith("/redoc"):
        return await call_next(request)
    if path.startswith(settings.api_v1_prefix):
        authorization = request.headers.get("authorization", "")
        if not authorization.lower().startswith("bearer "):
            return api_error("AUTH_REQUIRED", "Authentication token is required.", 401)
        token = authorization.split(" ", 1)[1].strip()
        try:
            principal = decode_demo_token(token)
        except ValueError as exc:
            return api_error("AUTH_INVALID", str(exc), 401)
        permission = permission_for_request(request.method, path)
        if not role_has_permission(principal.role, permission):
            return api_error("FORBIDDEN", "Your current role does not have permission to perform this action.", 403)
        request.state.user_id = principal.user_id
        request.state.role = principal.role
    return await call_next(request)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    code = "HTTP_ERROR" if exc.status_code < 500 else "SERVER_ERROR"
    return api_error(code, str(exc.detail), exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return api_error("VALIDATION_ERROR", "Request validation failed.", 422, exc.errors())


@app.exception_handler(DomainError)
async def domain_exception_handler(request: Request, exc: DomainError):
    return api_error("DOMAIN_RULE_VIOLATION", str(exc), exc.status_code)


def api_error(code: str, message: str, status_code: int, details=None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details or []}},
    )


@app.get("/")
def read_root():
    return {"service": "MillTrace PK API", "status": "online"}
