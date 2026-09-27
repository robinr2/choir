import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest

from voice.core_conversation import VOICE_EVENTS, CoreConversation

CONVERSATION = '/conversations/c1'

VoiceScript = list[dict[str, Any] | float]


class RecordingCore:
    def __init__(self) -> None:
        self.requests: list[tuple[str, Any]] = []
        self.methods: list[str] = []
        self.status = httpx.codes.OK
        self.voice_events: VoiceScript = []
        self.voice_events_closed = False

    async def _play(self, step: dict[str, Any] | float) -> bytes:
        if isinstance(step, float):
            await asyncio.sleep(step)
            return b''
        return f'id: 1\ndata: {json.dumps(step)}\n\n'.encode()

    async def _stream_voice_events(self) -> AsyncIterator[bytes]:
        try:
            for step in self.voice_events:
                yield await self._play(step)
        finally:
            self.voice_events_closed = True

    def handle(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == VOICE_EVENTS and request.method == 'GET':
            return httpx.Response(self.status, content=self._stream_voice_events())
        body = json.loads(request.content) if request.content else None
        self.requests.append((request.url.path.removeprefix(CONVERSATION), body))
        self.methods.append(request.method)
        if self.status != httpx.codes.OK:
            return httpx.Response(self.status)
        if request.url.path.endswith('/user-turns'):
            reply = json.dumps({'text': json.loads(request.content)['text']})
            return httpx.Response(self.status, text=f'id: 1\ndata: {reply}\n\n')
        return httpx.Response(httpx.codes.NO_CONTENT)

    def conversation(self, agent_id: str | None = 'c1') -> CoreConversation:
        conversation = CoreConversation(
            httpx.AsyncClient(
                transport=httpx.MockTransport(self.handle), base_url='http://core'
            )
        )
        conversation.agent_id = agent_id
        return conversation


@pytest.fixture
def core() -> RecordingCore:
    return RecordingCore()
