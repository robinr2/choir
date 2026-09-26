from fastapi import APIRouter, BackgroundTasks
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
)

from voice.bot import run_bot
from voice.dependencies import SettingsDep, WebRTCHandlerDep

router = APIRouter(prefix='/api/offer', tags=['webrtc'])


@router.post('')
async def offer(
    request: SmallWebRTCRequest,
    background_tasks: BackgroundTasks,
    settings: SettingsDep,
    handler: WebRTCHandlerDep,
) -> dict[str, str] | None:
    async def start_bot(connection: SmallWebRTCConnection) -> None:
        background_tasks.add_task(run_bot, connection, settings)

    return await handler.handle_web_request(request, start_bot)


@router.patch('')
async def add_ice_candidates(
    request: SmallWebRTCPatchRequest, handler: WebRTCHandlerDep
) -> dict[str, str]:
    await handler.handle_patch_request(request)
    return {'status': 'success'}
