from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.exceptions import AppException, app_exception_handler
from app.modules.admin.api import router as admin_router
from app.modules.auth.api import router as auth_router
from app.modules.cron.scheduler import start_scheduler, stop_scheduler
from app.modules.email.api import router as email_router
from app.modules.screenshot.api import router as screenshot_router
from app.modules.task.api import router as task_router
from app.modules.time_entry.api import router as time_router

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Start the daily report scheduler with the application and stop it on shutdown."""
    await start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title=settings.APP_NAME,
    summary="Task board, time tracking, and admin panel.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppException, app_exception_handler)

app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(email_router, prefix="/api/admin/email", tags=["Email"])
app.include_router(task_router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(time_router, prefix="/api/time", tags=["Time"])
app.include_router(screenshot_router, prefix="/api/screenshots", tags=["Screenshots"])


@app.get("/health", tags=["Health"])
async def health() -> dict[str, str]:
    """Liveness probe used by Docker."""
    return {"status": "ok"}
