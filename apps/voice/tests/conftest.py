import json
from typing import Any

import httpx
import pytest

from voice.core_conversation import CoreConversation


class RecordingCore:
    def __init__(self) -> None:
        self.requests: list[tuple[str, Any]] = []
        self.methods: list[str] = []
        self.status = httpx.codes.OK

    def handle(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else None
        self.requests.append((request.url.path, body))
        self.methods.append(request.method)
        if self.status != httpx.codes.OK:
            return httpx.Response(self.status)
        if request.url.path == '/conversation/user-turns':
            reply = json.dumps({'text': json.loads(request.content)['text']})
            return httpx.Response(self.status, text=f'id: 1\ndata: {reply}\n\n')
        return httpx.Response(httpx.codes.NO_CONTENT)

    def conversation(self) -> CoreConversation:
        return CoreConversation(
            httpx.AsyncClient(
                transport=httpx.MockTransport(self.handle), base_url='http://core'
            )
        )


@pytest.fixture
def core() -> RecordingCore:
    return RecordingCore()
