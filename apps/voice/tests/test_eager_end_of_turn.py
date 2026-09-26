import asyncio
from collections.abc import Sequence
from typing import Any

import pytest
from pipecat.frames.frames import (
    EagerTranscriptionFrame,
    Frame,
    InterimTranscriptionFrame,
    OutputTransportMessageUrgentFrame,
    ProposedUserStartedSpeakingFrame,
    ProposedUserStoppedSpeakingFrame,
    TranscriptionFrame,
    VADUserStartedSpeakingFrame,
    VADUserStoppedSpeakingFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.tests.utils import SleepFrame, run_test
from pipecat.transcriptions.language import Language
from pipecat.turns.types import ProcessFrameResult
from pipecat.turns.user_start import (
    BaseUserTurnStartStrategy,
    TranscriptionUserTurnStartStrategy,
    VADUserTurnStartStrategy,
)
from pipecat.turns.user_stop import SpeechTimeoutUserTurnStopStrategy
from pipecat.turns.user_turn_controller import UserTurnController
from pipecat.turns.user_turn_strategies import UserTurnStrategies

from voice import eager_end_of_turn
from voice.eager_end_of_turn import EagerEndOfTurn, eager_transcript

TURN_FRAMES = (
    InterimTranscriptionFrame,
    EagerTranscriptionFrame,
    TranscriptionFrame,
    ProposedUserStartedSpeakingFrame,
    ProposedUserStoppedSpeakingFrame,
)


def quick_turns(
    start: Sequence[BaseUserTurnStartStrategy] | None = None,
) -> UserTurnStrategies:
    return UserTurnStrategies(
        start=list(
            start or [VADUserTurnStartStrategy(), TranscriptionUserTurnStartStrategy()]
        ),
        stop=[SpeechTimeoutUserTurnStopStrategy(user_speech_timeout=0.05)],
    )


def said(text: str) -> TranscriptionFrame:
    return TranscriptionFrame(
        text=text, user_id='user', timestamp='now', finalized=True
    )


async def run(
    processor: FrameProcessor, *frames: Frame
) -> tuple[Sequence[Frame], Sequence[Frame]]:
    return await asyncio.wait_for(run_test(processor, frames_to_send=frames), 1)


def names(frames: Sequence[Frame]) -> list[str]:
    return [type(frame).__name__ for frame in frames if isinstance(frame, TURN_FRAMES)]


class PushingStartStrategy(BaseUserTurnStartStrategy):
    async def process_frame(self, frame: Frame) -> ProcessFrameResult:
        if isinstance(frame, VADUserStartedSpeakingFrame):
            await self.push_frame(OutputTransportMessageUrgentFrame(message='pushed'))
            await self.push_frame(
                OutputTransportMessageUrgentFrame(message='returned'),
                FrameDirection.UPSTREAM,
            )
            await self.broadcast_frame(  # pyright: ignore[reportUnknownMemberType]
                OutputTransportMessageUrgentFrame, message='broadcast'
            )
        return ProcessFrameResult.CONTINUE


def test_copies_a_final_transcript_as_eager() -> None:
    frame = TranscriptionFrame(
        text='hello', user_id='user', timestamp='now', language=Language.EN
    )
    eager = eager_transcript(frame)
    assert (eager.text, eager.user_id, eager.timestamp, eager.language) == (
        'hello',
        'user',
        'now',
        Language.EN,
    )


async def test_ends_the_turn_early_on_every_final_transcript() -> None:
    down, _ = await run(
        EagerEndOfTurn(quick_turns([VADUserTurnStartStrategy()])),
        InterimTranscriptionFrame(text='hel', user_id='user', timestamp='now'),
        said('hello'),
        said(' choir'),
    )
    assert names(down) == [
        'InterimTranscriptionFrame',
        'EagerTranscriptionFrame',
        'TranscriptionFrame',
        'EagerTranscriptionFrame',
        'TranscriptionFrame',
    ]
    eager = [frame.text for frame in down if isinstance(frame, EagerTranscriptionFrame)]
    assert eager == ['hello', ' choir']


async def test_proposes_the_turn_it_detects_both_ways() -> None:
    down, up = await run(
        EagerEndOfTurn(quick_turns()),
        VADUserStartedSpeakingFrame(),
        said('hello'),
        VADUserStoppedSpeakingFrame(),
        SleepFrame(sleep=0.3),
    )
    assert names(down) == [
        'ProposedUserStartedSpeakingFrame',
        'EagerTranscriptionFrame',
        'TranscriptionFrame',
        'ProposedUserStoppedSpeakingFrame',
    ]
    assert names(up) == [
        'ProposedUserStartedSpeakingFrame',
        'ProposedUserStoppedSpeakingFrame',
    ]


async def test_passes_on_the_frames_its_strategies_send() -> None:
    down, up = await run(
        EagerEndOfTurn(quick_turns([PushingStartStrategy()])),
        VADUserStartedSpeakingFrame(),
    )
    messages = [
        frame.message
        for frame in down
        if isinstance(frame, OutputTransportMessageUrgentFrame)
    ]
    assert messages == ['pushed', 'broadcast']
    assert [
        frame.message
        for frame in up
        if isinstance(frame, OutputTransportMessageUrgentFrame)
    ] == ['returned', 'broadcast']


async def test_hands_every_frame_to_the_base_processor_and_on(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    handled: list[tuple[str, FrameDirection]] = []
    pushed: list[tuple[str, FrameDirection]] = []

    async def process_frame(
        _processor: object, frame: Frame, direction: FrameDirection
    ) -> None:
        handled.append((type(frame).__name__, direction))

    async def push_frame(
        _processor: object, frame: Frame, direction: FrameDirection
    ) -> None:
        pushed.append((type(frame).__name__, direction))

    async def ignore(_controller: object, _frame: Frame) -> None:
        return None

    monkeypatch.setattr(FrameProcessor, 'process_frame', process_frame)
    monkeypatch.setattr(FrameProcessor, 'push_frame', push_frame)
    monkeypatch.setattr(UserTurnController, 'process_frame', ignore)
    await EagerEndOfTurn(quick_turns()).process_frame(
        said('hello'), FrameDirection.UPSTREAM
    )
    assert handled == [('TranscriptionFrame', FrameDirection.UPSTREAM)]
    assert pushed[:2] == [
        ('EagerTranscriptionFrame', FrameDirection.UPSTREAM),
        ('TranscriptionFrame', FrameDirection.UPSTREAM),
    ]


async def test_detects_turns_only_while_the_pipeline_runs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    async def start(_controller: object) -> None:
        calls.append('start')

    async def stop(_controller: object) -> None:
        calls.append('stop')

    monkeypatch.setattr(UserTurnController, 'start', start)
    monkeypatch.setattr(UserTurnController, 'stop', stop)
    await run(EagerEndOfTurn(quick_turns()), said('hello'))
    assert calls[:2] == ['start', 'stop']


def test_detects_turns_with_the_default_strategies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created: list[Any] = []

    def strategies() -> UserTurnStrategies:
        created.append(UserTurnStrategies())
        return created[-1]

    monkeypatch.setattr(eager_end_of_turn, 'UserTurnStrategies', strategies)
    EagerEndOfTurn()
    assert len(created) == 1
