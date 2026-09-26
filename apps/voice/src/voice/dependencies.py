from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCRequestHandler,
)

from voice.config import Settings


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_webrtc_handler() -> SmallWebRTCRequestHandler:
    return SmallWebRTCRequestHandler()


SettingsDep = Annotated[Settings, Depends(get_settings)]
WebRTCHandlerDep = Annotated[SmallWebRTCRequestHandler, Depends(get_webrtc_handler)]
