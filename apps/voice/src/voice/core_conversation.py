from collections.abc import AsyncIterator

import httpx
from pydantic import BaseModel

EVENT_DATA = 'data: '
STREAMED_METHOD = 'POST'


class ReplyChunk(BaseModel):
    text: str


async def event_data(response: httpx.Response) -> AsyncIterator[str]:
    async for line in response.aiter_lines():
        if line.startswith(EVENT_DATA):
            yield line.removeprefix(EVENT_DATA)


class CoreConversation:
    def __init__(self, client: httpx.AsyncClient, conversation_id: str) -> None:
        self._client = client
        self._path = f'/conversations/{conversation_id}'

    async def reply_to(self, text: str, *, early: bool) -> AsyncIterator[str]:
        async with self._client.stream(
            STREAMED_METHOD,
            f'{self._path}/user-turns',
            json={'text': text, 'early': early, 'voice': True},
        ) as response:
            response.raise_for_status()
            async for data in event_data(response):
                yield ReplyChunk.model_validate_json(data).text

    async def confirm(self) -> None:
        await self._post('confirmations')

    async def withdraw(self) -> None:
        await self._post('withdrawals')

    async def interrupt(self, heard: str) -> None:
        await self._post('interruptions', {'heard': heard})

    async def _post(self, action: str, body: dict[str, str] | None = None) -> None:
        response = await self._client.post(f'{self._path}/{action}', json=body)
        response.raise_for_status()
