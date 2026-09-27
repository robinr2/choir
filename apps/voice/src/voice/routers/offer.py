from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
)

from voice.bot import run_bot
from voice.dependencies import SettingsDep, WebRTCHandlerDep

router = APIRouter(prefix='/api/offer', tags=['webrtc'])

BotStarter = Callable[[SmallWebRTCConnection], Awaitable[None]]


def bot_starter(background_tasks: BackgroundTasks, settings: SettingsDep) -> BotStarter:
    async def start_bot(connection: SmallWebRTCConnection) -> None:
        background_tasks.add_task(run_bot, connection, settings)

    return start_bot


@router.post('')
async def offer(
    request: SmallWebRTCRequest,
    start_bot: Annotated[BotStarter, Depends(bot_starter)],
    handler: WebRTCHandlerDep,
) -> dict[str, str] | None:
    return await handler.handle_web_request(request, start_bot)


@router.patch('')
async def add_ice_candidates(
    request: SmallWebRTCPatchRequest, handler: WebRTCHandlerDep
) -> dict[str, str]:
    await handler.handle_patch_request(request)
    return {'status': 'success'}
