from fastapi import FastAPI
from app.api.router import api_router
from app.core.config import settings
from app.core.middleware import request_context_middleware

app = FastAPI(title=settings.app_name)
app.middleware("http")(request_context_middleware)
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
