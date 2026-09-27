import asyncio

from pipecat.frames.frames import (
    EagerEndOfTurnCancelFrame,
    EagerTranscriptionFrame,
    Frame,
    ProposedUserStartedSpeakingFrame,
    ProposedUserStoppedSpeakingFrame,
    STTMetadataFrame,
    TranscriptionFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
)
from pipecat.tests.utils import SleepFrame, run_test
from pipecat.turns.user_turn_strategies import EagerUserTurnStrategies

from tests.conftest import RecordingCore
from voice.conversation_llm import ConversationLLMService

CONFIRMATION = ('/confirmations', {'text': 'hello choir'})
WITHDRAWAL = ('/withdrawals', None)
EAGER_STT = STTMetadataFrame(
    service_name='eager-stt',
    ttfs_p99_latency=0,
    user_turn_strategies=EagerUserTurnStrategies(),
)


def asked(text: str, *, early: bool = False) -> tuple[str, dict[str, object]]:
    return ('/user-turns', {'text': text, 'early': early, 'voice': True})


def said(text: str) -> TranscriptionFrame:
    return TranscriptionFrame(
        text=text, user_id='user', timestamp='now', finalized=True
    )


def predicted(text: str) -> EagerTranscriptionFrame:
    return EagerTranscriptionFrame(text=text, user_id='user', timestamp='now')


async def converse(core: RecordingCore, *frames: Frame) -> None:
    user_aggregator, _ = LLMContextAggregatorPair(LLMContext())
    pipeline = Pipeline([user_aggregator, ConversationLLMService(core.conversation())])
    await asyncio.wait_for(run_test(pipeline, frames_to_send=[EAGER_STT, *frames]), 3)


async def test_answers_early_and_confirms_once_the_turn_ends(
    core: RecordingCore,
) -> None:
    await converse(
        core,
        ProposedUserStartedSpeakingFrame(),
        predicted('hello choir'),
        SleepFrame(sleep=0.1),
        said('hello choir'),
        ProposedUserStoppedSpeakingFrame(),
        SleepFrame(sleep=0.3),
    )
    assert core.requests == [asked('hello choir', early=True), CONFIRMATION]


async def test_withdraws_an_early_answer_the_user_talks_past(
    core: RecordingCore,
) -> None:
    await converse(
        core,
        ProposedUserStartedSpeakingFrame(),
        predicted('hello'),
        SleepFrame(sleep=0.1),
        EagerEndOfTurnCancelFrame(),
        SleepFrame(sleep=0.1),
        said('hello choir'),
        ProposedUserStoppedSpeakingFrame(),
        SleepFrame(sleep=0.3),
    )
    assert core.requests == [
        asked('hello', early=True),
        WITHDRAWAL,
        asked('hello choir'),
    ]
