from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles
import asyncio
import logging
import os
from pathlib import Path

from aws_api.v1.dynamodb import ping
from aws_api.v1.table_router import router as table_router
from aws_api.v1.hoo_router import hoo_router
from aws_api.v1.connect_router import connect_router

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    for attempt in range(20):
        try:
            await asyncio.to_thread(ping)
            logger.info("DynamoDB reachable")
            break
        except Exception as e:
            logger.warning(f"DynamoDB not ready (attempt {attempt + 1}/20): {e}")
            if attempt < 19:
                await asyncio.sleep(1)
    else:
        logger.error("DynamoDB unreachable after 20 attempts — starting anyway")
    yield


app = FastAPI(title="Contact Center HQ", lifespan=lifespan)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/health/deep")
async def health_deep(response: Response):
    try:
        await asyncio.to_thread(ping)
        return {"status": "ok", "dynamodb": "ok"}
    except Exception as e:
        response.status_code = 503
        return {"status": "degraded", "dynamodb": "unreachable", "detail": str(e)}


app.include_router(table_router, prefix="/api/v1/table")
app.include_router(hoo_router, prefix="/api/v1/hoo")
app.include_router(connect_router, prefix="/api/v1/connect")


# Serve the React SPA last so /api/* routes take priority.
STATIC_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
