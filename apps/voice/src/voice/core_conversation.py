from collections.abc import AsyncIterator
from typing import Annotated, Literal

import httpx
from pydantic import BaseModel, Field, TypeAdapter

EVENT_DATA = 'data: '
STREAMED_METHOD = 'POST'
EVENTS_METHOD = 'GET'
VOICE_EVENTS = '/voice/events'


class ReplyChunk(BaseModel):
    text: str


class AgentChanged(BaseModel):
    type: Literal['agent']
    agent_id: str | None = Field(alias='agentId')


class Reply(BaseModel):
    type: Literal['reply']
    text: str


class ReplyEnd(BaseModel):
    type: Literal['reply-end']


VoiceEvent = Annotated[AgentChanged | Reply | ReplyEnd, Field(discriminator='type')]

voice_event = TypeAdapter[VoiceEvent](VoiceEvent)


async def event_data(response: httpx.Response) -> AsyncIterator[str]:
    async for line in response.aiter_lines():
        if line.startswith(EVENT_DATA):
            yield line.removeprefix(EVENT_DATA)


class CoreConversation:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client
        self.agent_id: str | None = None

    @property
    def _path(self) -> str:
        return f'/conversations/{self.agent_id}'

    async def events(self) -> AsyncIterator[VoiceEvent]:
        async with self._client.stream(EVENTS_METHOD, VOICE_EVENTS) as response:
            response.raise_for_status()
            async for data in event_data(response):
                yield voice_event.validate_json(data)

    async def reply_to(self, text: str, *, early: bool) -> AsyncIterator[str]:
        if self.agent_id is None:
            return
        async with self._client.stream(
            STREAMED_METHOD,
            f'{self._path}/user-turns',
            json={'text': text, 'early': early, 'voice': True},
        ) as response:
            response.raise_for_status()
            async for data in event_data(response):
                yield ReplyChunk.model_validate_json(data).text

    async def confirm(self, text: str) -> None:
        await self._post('confirmations', {'text': text})

    async def withdraw(self) -> None:
        await self._post('withdrawals')

    async def interrupt(self, heard: str) -> None:
        await self._post('interruptions', {'heard': heard})

    async def _post(self, action: str, body: dict[str, str] | None = None) -> None:
        if self.agent_id is None:
            return
        response = await self._client.post(f'{self._path}/{action}', json=body)
        response.raise_for_status()
