from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from voice.dependencies import get_settings, get_webrtc_handler
from voice.routers import offer


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    get_settings()
    yield
    await get_webrtc_handler().close()


app = FastAPI(lifespan=lifespan)
app.include_router(offer.router)
