from collections.abc import Awaitable, Callable
from typing import Any, ClassVar

import pytest
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.pipeline.worker import PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMUserAggregatorParams,
)
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pydantic import SecretStr

from tests.conftest import RecordingCore
from voice import bot
from voice.config import Settings
from voice.core_conversation import CoreConversation

Handler = Callable[..., Awaitable[None]]
Calls = list[tuple[tuple[Any, ...], dict[str, Any]]]

SETTINGS = Settings(xai_api_key=SecretStr('xai-key'), core_url='http://core')


def spy(monkeypatch: pytest.MonkeyPatch, name: str) -> Calls:
    calls: Calls = []
    original = getattr(bot, name)

    def record(*args: Any, **kwargs: Any) -> Any:
        calls.append((args, kwargs))
        return original(*args, **kwargs)

    monkeypatch.setattr(bot, name, record)
    return calls


class RecordingTransport(SmallWebRTCTransport):
    created: ClassVar[list['RecordingTransport']] = []

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.handlers: dict[str, Handler] = {}
        self.params = kwargs['params']
        RecordingTransport.created.append(self)

    def add_event_handler(self, event_name: str, handler: Handler) -> None:
        self.handlers[event_name] = handler


class DisconnectingRunner:
    runs: ClassVar[list[tuple[dict[str, Any], PipelineWorker]]] = []

    def __init__(self, **kwargs: Any) -> None:
        self.options = kwargs

    async def run(self, worker: PipelineWorker) -> None:
        DisconnectingRunner.runs.append((self.options, worker))
        transport = RecordingTransport.created[-1]
        await transport.handlers['on_client_disconnected'](transport, None)


def test_builds_the_voice_pipeline(
    monkeypatch: pytest.MonkeyPatch, core: RecordingCore
) -> None:
    stt = spy(monkeypatch, 'XAISTTService')
    tts = spy(monkeypatch, 'XAITTSService')
    llm = spy(monkeypatch, 'ConversationLLMService')
    aggregators = spy(monkeypatch, 'LLMContextAggregatorPair')
    user_params = spy(monkeypatch, 'LLMUserAggregatorParams')
    transport = SmallWebRTCTransport(
        webrtc_connection=SmallWebRTCConnection(), params=TransportParams()
    )
    conversation = core.conversation()
    pipeline = bot.create_pipeline(transport, SETTINGS, conversation)
    assert [type(processor).__name__ for processor in pipeline.processors][1:-1] == [
        'SmallWebRTCInputTransport',
        'XAISTTService',
        'LLMUserAggregator',
        'ConversationLLMService',
        'XAITTSService',
        'SmallWebRTCOutputTransport',
        'LLMAssistantAggregator',
    ]
    assert stt == [((), {'api_key': 'xai-key'})]
    assert tts == [((), {'api_key': 'xai-key'})]
    assert llm == [((conversation,), {})]
    [((context,), aggregator_options)] = aggregators
    assert isinstance(context, LLMContext)
    assert isinstance(aggregator_options['user_params'], LLMUserAggregatorParams)
    [(_, params)] = user_params
    assert isinstance(params['vad_analyzer'], SileroVADAnalyzer)


async def test_runs_the_bot_until_the_client_disconnects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(bot, 'SmallWebRTCTransport', RecordingTransport)
    monkeypatch.setattr(bot, 'WorkerRunner', DisconnectingRunner)
    conversations = spy(monkeypatch, 'CoreConversation')
    pipelines = spy(monkeypatch, 'create_pipeline')
    cancelled: list[PipelineWorker] = []

    async def cancel(worker: PipelineWorker) -> None:
        cancelled.append(worker)

    monkeypatch.setattr(PipelineWorker, 'cancel', cancel)
    await bot.run_bot(SmallWebRTCConnection(), SETTINGS)
    options, worker = DisconnectingRunner.runs[-1]
    transport = RecordingTransport.created[-1]
    assert options == {'handle_sigint': False}
    assert transport.params.audio_in_enabled
    assert transport.params.audio_out_enabled
    assert cancelled == [worker]
    [((client,), _)] = conversations
    assert str(client.base_url) == 'http://core'
    [((piped_transport, settings, conversation), _)] = pipelines
    assert piped_transport is transport
    assert settings is SETTINGS
    assert isinstance(conversation, CoreConversation)
