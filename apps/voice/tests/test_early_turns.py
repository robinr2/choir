import asyncio

from pipecat.frames.frames import (
    Frame,
    TranscriptionFrame,
    VADUserStartedSpeakingFrame,
    VADUserStoppedSpeakingFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.tests.utils import SleepFrame, run_test
from pipecat.turns.user_start import VADUserTurnStartStrategy
from pipecat.turns.user_stop import SpeechTimeoutUserTurnStopStrategy
from pipecat.turns.user_turn_strategies import (
    EagerUserTurnStrategies,
    UserTurnStrategies,
)

from tests.conftest import RecordingCore
from voice.conversation_llm import ConversationLLMService
from voice.eager_end_of_turn import EagerEndOfTurn

CONFIRMATION = ('/confirmations', None)
WITHDRAWAL = ('/withdrawals', None)


def early(text: str) -> tuple[str, dict[str, object]]:
    return ('/user-turns', {'text': text, 'early': True, 'voice': True})


def said(text: str) -> TranscriptionFrame:
    return TranscriptionFrame(
        text=text, user_id='user', timestamp='now', finalized=True
    )


async def converse(core: RecordingCore, *frames: Frame) -> None:
    user_aggregator, _ = LLMContextAggregatorPair(
        LLMContext(),
        user_params=LLMUserAggregatorParams(
            user_turn_strategies=EagerUserTurnStrategies()
        ),
    )
    pipeline = Pipeline(
        [
            EagerEndOfTurn(
                UserTurnStrategies(
                    start=[VADUserTurnStartStrategy()],
                    stop=[SpeechTimeoutUserTurnStopStrategy(user_speech_timeout=0.2)],
                )
            ),
            user_aggregator,
            ConversationLLMService(core.conversation()),
        ]
    )
    await asyncio.wait_for(run_test(pipeline, frames_to_send=frames), 3)


async def test_answers_early_and_confirms_once_the_turn_ends(
    core: RecordingCore,
) -> None:
    await converse(
        core,
        VADUserStartedSpeakingFrame(),
        said('hello choir'),
        SleepFrame(sleep=0.1),
        VADUserStoppedSpeakingFrame(),
        SleepFrame(sleep=0.5),
    )
    assert core.requests == [early('hello choir'), CONFIRMATION]


async def test_withdraws_an_early_answer_the_user_talks_past(
    core: RecordingCore,
) -> None:
    await converse(
        core,
        VADUserStartedSpeakingFrame(),
        said('hello'),
        SleepFrame(sleep=0.1),
        said(' choir'),
        SleepFrame(sleep=0.1),
        VADUserStoppedSpeakingFrame(),
        SleepFrame(sleep=0.5),
    )
    assert core.requests == [
        early('hello'),
        WITHDRAWAL,
        early('hello choir'),
        CONFIRMATION,
    ]
