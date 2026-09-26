from collections.abc import AsyncIterator

import httpx
from pydantic import BaseModel

EVENT_DATA = 'data: '
STREAMED_METHOD = 'POST'
USER_TURNS = '/conversation/user-turns'
WITHDRAWALS = '/conversation/withdrawals'
INTERRUPTIONS = '/conversation/interruptions'


class ReplyChunk(BaseModel):
    text: str


async def event_data(response: httpx.Response) -> AsyncIterator[str]:
    async for line in response.aiter_lines():
        if line.startswith(EVENT_DATA):
            yield line.removeprefix(EVENT_DATA)


class CoreConversation:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def reply_to(self, text: str) -> AsyncIterator[str]:
        async with self._client.stream(
            STREAMED_METHOD, USER_TURNS, json={'text': text}
        ) as response:
            response.raise_for_status()
            async for data in event_data(response):
                yield ReplyChunk.model_validate_json(data).text

    async def withdraw(self) -> None:
        response = await self._client.post(WITHDRAWALS)
        response.raise_for_status()

    async def interrupt(self, heard: str) -> None:
        response = await self._client.post(INTERRUPTIONS, json={'heard': heard})
        response.raise_for_status()
