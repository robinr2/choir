import httpx
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.xai.stt import XAISTTService
from pipecat.services.xai.tts import XAITTSService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

from voice.config import Settings
from voice.conversation_llm import ConversationLLMService
from voice.core_conversation import CoreConversation


def create_pipeline(
    transport: SmallWebRTCTransport,
    settings: Settings,
    conversation: CoreConversation,
) -> Pipeline:
    xai_api_key = settings.xai_api_key.get_secret_value()
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        LLMContext(),
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )
    return Pipeline(
        [
            transport.input(),
            XAISTTService(api_key=xai_api_key),
            user_aggregator,
            ConversationLLMService(conversation),
            XAITTSService(api_key=xai_api_key),
            transport.output(),
            assistant_aggregator,
        ]
    )


async def run_bot(connection: SmallWebRTCConnection, settings: Settings) -> None:
    transport = SmallWebRTCTransport(
        webrtc_connection=connection,
        params=TransportParams(audio_in_enabled=True, audio_out_enabled=True),
    )
    async with httpx.AsyncClient(base_url=settings.core_url) as client:
        conversation = CoreConversation(client)
        worker = PipelineWorker(create_pipeline(transport, settings, conversation))

        @transport.event_handler('on_client_disconnected')
        async def on_client_disconnected(
            _transport: SmallWebRTCTransport, _connection: SmallWebRTCConnection
        ) -> None:
            await worker.cancel()

        await WorkerRunner(handle_sigint=False).run(worker)
