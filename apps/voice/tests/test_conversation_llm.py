import asyncio
from collections.abc import Sequence

import pytest
from pipecat.frames.frames import (
    EagerEndOfTurnCancelFrame,
    Frame,
    InterruptionFrame,
    LLMContextAssistantTurnFrame,
    LLMContextFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMServiceMetadataFrame,
    LLMTextFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.frame_processor import FrameDirection
from pipecat.services.llm_service import LLMService
from pipecat.services.settings import LLMSettings
from pipecat.tests.utils import SleepFrame, run_test

from tests.conftest import RecordingCore
from voice.conversation_llm import ConversationLLMService, latest_user_words

USER_TURN = '/conversation/user-turns'
WITHDRAWAL = ('/conversation/withdrawals', None)


def user_said(text: str, *, speculation: bool = False) -> LLMContextFrame:
    context = LLMContext(messages=[{'role': 'user', 'content': text}])
    return LLMContextFrame(context=context, speculation=speculation)


def turn_heard(text: str) -> LLMContextAssistantTurnFrame:
    return LLMContextAssistantTurnFrame(text=text, timestamp='')


def without_metadata(frames: Sequence[Frame]) -> list[Frame]:
    return [frame for frame in frames if not isinstance(frame, LLMServiceMetadataFrame)]


async def run(core: RecordingCore, *frames: Frame) -> list[Frame]:
    service = ConversationLLMService(core.conversation())
    down, _ = await asyncio.wait_for(run_test(service, frames_to_send=frames), 1)
    return without_metadata(down)


def test_has_no_model_settings(core: RecordingCore) -> None:
    service = ConversationLLMService(core.conversation())
    assert service.settings == LLMSettings(
        model=None,
        system_instruction=None,
        temperature=None,
        max_tokens=None,
        top_p=None,
        top_k=None,
        frequency_penalty=None,
        presence_penalty=None,
        seed=None,
        filter_incomplete_user_turns=None,
        user_turn_completion_config=None,
    )


async def test_hands_every_frame_to_the_base_service_and_on(
    monkeypatch: pytest.MonkeyPatch, core: RecordingCore
) -> None:
    handled: list[tuple[Frame, FrameDirection]] = []
    pushed: list[tuple[Frame, FrameDirection]] = []

    async def process_frame(
        _service: object, frame: Frame, direction: FrameDirection
    ) -> None:
        handled.append((frame, direction))

    async def push_frame(
        _service: object, frame: Frame, direction: FrameDirection
    ) -> None:
        pushed.append((frame, direction))

    monkeypatch.setattr(LLMService, 'process_frame', process_frame)
    monkeypatch.setattr(LLMService, 'push_frame', push_frame)
    frame = turn_heard('hello')
    await ConversationLLMService(core.conversation()).process_frame(
        frame, FrameDirection.UPSTREAM
    )
    assert handled == [(frame, FrameDirection.UPSTREAM)]
    assert pushed == [(frame, FrameDirection.UPSTREAM)]


def test_takes_the_words_of_the_latest_user_message() -> None:
    context = LLMContext(
        messages=[
            {'role': 'user', 'content': 'first'},
            {'role': 'user', 'content': 'second'},
        ]
    )
    assert latest_user_words(context) == 'second'


def test_takes_no_words_when_the_user_did_not_speak_last() -> None:
    assert latest_user_words(LLMContext()) == ''
    replied = LLMContext(messages=[{'role': 'assistant', 'content': 'hello'}])
    assert latest_user_words(replied) == ''
    parts = LLMContext(
        messages=[{'role': 'user', 'content': [{'type': 'text', 'text': 'hi'}]}]
    )
    assert latest_user_words(parts) == ''


async def test_speaks_the_reply_core_streams_back(core: RecordingCore) -> None:
    down = await run(core, user_said('hello choir'))
    assert [type(frame) for frame in down] == [
        LLMFullResponseStartFrame,
        LLMTextFrame,
        LLMFullResponseEndFrame,
    ]
    assert [frame.text for frame in down if isinstance(frame, LLMTextFrame)] == [
        'hello choir'
    ]
    assert core.requests == [(USER_TURN, {'text': 'hello choir'})]


async def test_asks_core_nothing_without_new_words(core: RecordingCore) -> None:
    down = await run(core, LLMContextFrame(context=LLMContext()))
    assert [type(frame) for frame in down] == [
        LLMFullResponseStartFrame,
        LLMFullResponseEndFrame,
    ]
    assert core.requests == []


async def test_passes_other_frames_along(core: RecordingCore) -> None:
    down = await run(core, turn_heard('hello'))
    assert [type(frame) for frame in down] == [LLMContextAssistantTurnFrame]


async def test_passes_frames_back_up(core: RecordingCore) -> None:
    service = ConversationLLMService(core.conversation())
    _, up = await asyncio.wait_for(
        run_test(
            service,
            frames_to_send=[turn_heard('hello')],
            frames_to_send_direction=FrameDirection.UPSTREAM,
        ),
        1,
    )
    assert [type(frame) for frame in without_metadata(up)] == [
        LLMContextAssistantTurnFrame
    ]


async def test_reports_how_much_of_an_interrupted_reply_was_heard(
    core: RecordingCore,
) -> None:
    await run(
        core,
        user_said('hello choir'),
        SleepFrame(sleep=0.1),
        InterruptionFrame(),
        turn_heard('hello'),
    )
    assert core.requests == [
        (USER_TURN, {'text': 'hello choir'}),
        ('/conversation/interruptions', {'heard': 'hello'}),
    ]


async def test_reports_an_interruption_nothing_was_heard_of(
    core: RecordingCore,
) -> None:
    await run(
        core,
        user_said('hello choir'),
        SleepFrame(sleep=0.1),
        InterruptionFrame(),
        user_said('wait'),
    )
    assert core.requests == [
        (USER_TURN, {'text': 'hello choir'}),
        ('/conversation/interruptions', {'heard': ''}),
        (USER_TURN, {'text': 'wait'}),
    ]


async def test_reports_no_interruption_once_the_reply_was_heard(
    core: RecordingCore,
) -> None:
    await run(
        core,
        InterruptionFrame(),
        user_said('hello choir'),
        SleepFrame(sleep=0.1),
        turn_heard('hello choir'),
        SleepFrame(sleep=0.1),
        InterruptionFrame(),
        user_said('again'),
    )
    assert core.requests == [
        (USER_TURN, {'text': 'hello choir'}),
        (USER_TURN, {'text': 'again'}),
    ]


async def test_reports_no_interruption_of_an_answer_without_words(
    core: RecordingCore,
) -> None:
    await run(
        core,
        LLMContextFrame(context=LLMContext()),
        SleepFrame(sleep=0.1),
        InterruptionFrame(),
        user_said('hello choir'),
    )
    assert core.requests == [(USER_TURN, {'text': 'hello choir'})]


async def test_withdraws_an_early_start_the_user_talked_past(
    core: RecordingCore,
) -> None:
    await run(
        core,
        user_said('hello', speculation=True),
        SleepFrame(sleep=0.1),
        EagerEndOfTurnCancelFrame(),
        InterruptionFrame(),
        user_said('hello choir'),
    )
    assert core.requests == [
        (USER_TURN, {'text': 'hello'}),
        WITHDRAWAL,
        (USER_TURN, {'text': 'hello choir'}),
    ]


async def test_withdraws_an_early_start_the_user_interrupted(
    core: RecordingCore,
) -> None:
    await run(
        core,
        user_said('hello', speculation=True),
        SleepFrame(sleep=0.1),
        InterruptionFrame(),
        user_said('hello choir'),
    )
    assert core.requests == [
        (USER_TURN, {'text': 'hello'}),
        WITHDRAWAL,
        (USER_TURN, {'text': 'hello choir'}),
    ]


async def test_keeps_an_early_start_the_user_confirmed(
    core: RecordingCore,
) -> None:
    await run(
        core,
        user_said('hello choir', speculation=True),
        SleepFrame(sleep=0.1),
        UserStoppedSpeakingFrame(),
        EagerEndOfTurnCancelFrame(),
    )
    assert core.requests == [(USER_TURN, {'text': 'hello choir'})]


async def test_withdraws_nothing_before_anything_was_said(
    core: RecordingCore,
) -> None:
    await run(core, EagerEndOfTurnCancelFrame(), user_said('hello choir'))
    assert core.requests == [(USER_TURN, {'text': 'hello choir'})]


async def test_withdraws_nothing_that_did_not_start_early(
    core: RecordingCore,
) -> None:
    await run(
        core,
        user_said('hello choir'),
        SleepFrame(sleep=0.1),
        EagerEndOfTurnCancelFrame(),
    )
    assert core.requests == [(USER_TURN, {'text': 'hello choir'})]
