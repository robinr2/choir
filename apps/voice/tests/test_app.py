from collections.abc import Awaitable, Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)
from pydantic import SecretStr, ValidationError

from voice import main
from voice.config import Settings
from voice.dependencies import get_settings, get_webrtc_handler
from voice.routers import offer

SETTINGS = Settings(xai_api_key=SecretStr('xai-key'))
ANSWER = {'sdp': 'answer-sdp', 'type': 'answer', 'pc_id': 'pc-1'}


class FakeHandler(SmallWebRTCRequestHandler):
    def __init__(self) -> None:
        super().__init__()
        self.offers: list[SmallWebRTCRequest] = []
        self.patches: list[SmallWebRTCPatchRequest] = []
        self.closed = False

    async def handle_web_request(
        self,
        request: SmallWebRTCRequest,
        webrtc_connection_callback: Callable[[Any], Awaitable[None]],
    ) -> dict[str, str] | None:
        self.offers.append(request)
        await webrtc_connection_callback('connection')
        return ANSWER

    async def handle_patch_request(self, request: SmallWebRTCPatchRequest) -> None:
        self.patches.append(request)

    async def close(self) -> None:
        self.closed = True


@pytest.fixture
def handler(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeHandler]:
    fake = FakeHandler()
    monkeypatch.setattr(main, 'get_webrtc_handler', lambda: fake)
    main.app.dependency_overrides[get_webrtc_handler] = lambda: fake
    main.app.dependency_overrides[get_settings] = lambda: SETTINGS
    yield fake
    main.app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def fresh_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv('XAI_API_KEY', 'xai-key')
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_reads_the_xai_api_key_at_startup(
    monkeypatch: pytest.MonkeyPatch, handler: FakeHandler
) -> None:
    monkeypatch.delenv('XAI_API_KEY')
    with pytest.raises(ValidationError), TestClient(main.app):
        pass
    assert not handler.closed


def test_closes_the_webrtc_connections_at_shutdown(handler: FakeHandler) -> None:
    with TestClient(main.app):
        assert not handler.closed
    assert handler.closed


def test_answers_an_offer_and_starts_the_bot(
    monkeypatch: pytest.MonkeyPatch, handler: FakeHandler
) -> None:
    started: list[tuple[Any, Settings]] = []

    async def run_bot(connection: Any, settings: Settings) -> None:
        started.append((connection, settings))

    monkeypatch.setattr(offer, 'run_bot', run_bot)
    with TestClient(main.app) as client:
        response = client.post('/api/offer', json={'sdp': 'offer-sdp', 'type': 'offer'})
    assert response.json() == ANSWER
    assert handler.offers == [SmallWebRTCRequest(sdp='offer-sdp', type='offer')]
    assert started == [('connection', SETTINGS)]


def test_adds_ice_candidates(handler: FakeHandler) -> None:
    with TestClient(main.app) as client:
        response = client.patch('/api/offer', json={'pc_id': 'pc-1', 'candidates': []})
    assert response.json() == {'status': 'success'}
    assert handler.patches == [SmallWebRTCPatchRequest(pc_id='pc-1', candidates=[])]


def test_reads_settings_from_the_environment() -> None:
    assert get_settings().xai_api_key.get_secret_value() == 'xai-key'
    assert get_settings().core_url == 'http://localhost:3000'
    assert get_settings() is get_settings()


def test_keeps_one_webrtc_handler() -> None:
    assert isinstance(get_webrtc_handler(), SmallWebRTCRequestHandler)
    assert get_webrtc_handler() is get_webrtc_handler()
