import asyncio
from collections.abc import Sequence

from pipecat.frames.frames import (
    CancelFrame,
    ErrorFrame,
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
from pipecat.tests.utils import SleepFrame, run_test

from tests.conftest import RecordingCore
from voice.conversation_llm import ConversationLLMService


def agent(agent_id: str | None) -> dict[str, object]:
    return {'type': 'agent', 'agentId': agent_id}


def reply(text: str) -> dict[str, object]:
    return {'type': 'reply', 'text': text}


REPLY_END = {'type': 'reply-end'}


def user_said(text: str, *, speculation: bool = False) -> LLMContextFrame:
    context = LLMContext(messages=[{'role': 'user', 'content': text}])
    return LLMContextFrame(context=context, speculation=speculation)


def asked(agent_id: str, text: str, *, early: bool = False) -> tuple[str, object]:
    body = {'text': text, 'early': early, 'voice': True}
    return (f'/conversations/{agent_id}/user-turns', body)


def spoken(frames: Sequence[Frame]) -> list[object]:
    return [
        frame.text if isinstance(frame, LLMTextFrame) else type(frame)
        for frame in frames
        if not isinstance(frame, LLMServiceMetadataFrame)
    ]


async def run(
    core: RecordingCore, *frames: Frame, agent_id: str | None = None
) -> list[Frame]:
    service = ConversationLLMService(core.conversation(agent_id))
    down, up = await asyncio.wait_for(run_test(service, frames_to_send=frames), 2)
    assert [frame for frame in up if isinstance(frame, ErrorFrame)] == []
    return list(down)


async def test_talks_to_the_agent_core_points_voice_at(core: RecordingCore) -> None:
    core.voice_events = [agent('c2')]
    await run(core, SleepFrame(sleep=0.1), user_said('hello'))
    assert core.requests == [asked('c2', 'hello')]


async def test_asks_nothing_while_voice_points_at_no_agent(
    core: RecordingCore,
) -> None:
    core.voice_events = [agent(None)]
    down = await run(
        core,
        SleepFrame(sleep=0.1),
        user_said('hello', speculation=True),
        UserStoppedSpeakingFrame(),
        InterruptionFrame(),
    )
    assert core.requests == []
    assert LLMTextFrame not in [type(frame) for frame in down]


async def test_speaks_the_replies_to_turns_the_user_typed(
    core: RecordingCore,
) -> None:
    core.voice_events = [agent('c1'), reply('Hel'), reply('lo.'), REPLY_END]
    down = await run(core, SleepFrame(sleep=0.2))
    assert spoken(down) == [
        LLMFullResponseStartFrame,
        'Hel',
        'lo.',
        LLMFullResponseEndFrame,
    ]


async def test_ends_no_reply_it_did_not_start(core: RecordingCore) -> None:
    core.voice_events = [REPLY_END]
    down = await run(core, SleepFrame(sleep=0.2))
    assert spoken(down) == []


async def test_stops_speaking_a_reply_the_user_talks_over(
    core: RecordingCore,
) -> None:
    core.voice_events = [reply('Once upon'), 0.2, reply(' a time'), REPLY_END]
    down = await run(
        core,
        SleepFrame(sleep=0.1),
        InterruptionFrame(),
        LLMContextAssistantTurnFrame(text='Once', timestamp=''),
        SleepFrame(sleep=0.3),
        agent_id='c1',
    )
    assert ' a time' not in spoken(down)
    assert core.requests == [('/interruptions', {'heard': 'Once'})]


async def test_speaks_the_next_reply_after_one_the_user_talked_over(
    core: RecordingCore,
) -> None:
    core.voice_events = [reply('Once'), 0.2, REPLY_END, reply('Next'), REPLY_END]
    down = await run(
        core,
        SleepFrame(sleep=0.1),
        InterruptionFrame(),
        SleepFrame(sleep=0.3),
        agent_id='c1',
    )
    assert spoken(down)[-3:] == [
        LLMFullResponseStartFrame,
        'Next',
        LLMFullResponseEndFrame,
    ]


async def test_falls_silent_but_lets_the_previous_agent_work_on_a_switch(
    core: RecordingCore,
) -> None:
    core.voice_events = [0.2, agent('c2')]
    down = await run(
        core,
        user_said('hello choir', speculation=True),
        SleepFrame(sleep=0.3),
        LLMContextAssistantTurnFrame(text='hel', timestamp=''),
        user_said('next'),
        agent_id='c1',
    )
    assert InterruptionFrame in [type(frame) for frame in down]
    assert core.requests == [
        ('/user-turns', {'text': 'hello choir', 'early': True, 'voice': True}),
        ('/confirmations', {'text': 'hello choir'}),
        asked('c2', 'next'),
    ]


async def test_stops_a_reply_that_voice_switched_away_from(
    core: RecordingCore,
) -> None:
    core.voice_events = [reply('Hel'), 0.1, agent('c2'), reply('Bye'), REPLY_END]
    down = await run(core, SleepFrame(sleep=0.3), agent_id='c1')
    assert spoken(down)[:2] == [LLMFullResponseStartFrame, 'Hel']
    assert spoken(down)[-3:] == [
        LLMFullResponseStartFrame,
        'Bye',
        LLMFullResponseEndFrame,
    ]


async def test_keeps_talking_to_the_same_agent(core: RecordingCore) -> None:
    core.voice_events = [agent('c1'), agent('c1')]
    down = await run(core, SleepFrame(sleep=0.2), agent_id='c1')
    assert InterruptionFrame not in [type(frame) for frame in down]


async def test_stops_following_core_when_the_pipeline_ends(
    core: RecordingCore,
) -> None:
    service = ConversationLLMService(core.conversation())
    core.voice_events = [0.1, 5.0]
    await asyncio.wait_for(run_test(service, frames_to_send=[]), 2)
    assert core.voice_events_closed
    await service.process_frame(CancelFrame(), FrameDirection.DOWNSTREAM)


async def test_stops_following_nothing_before_the_pipeline_starts(
    core: RecordingCore,
) -> None:
    service = ConversationLLMService(core.conversation())
    await service.process_frame(CancelFrame(), FrameDirection.DOWNSTREAM)
    assert not core.voice_events_closed


async def test_reports_no_interruption_to_the_agent_voice_switched_to(
    core: RecordingCore,
) -> None:
    core.voice_events = [0.2, agent('c2')]
    await run(
        core,
        user_said('hello choir'),
        SleepFrame(sleep=0.1),
        InterruptionFrame(),
        SleepFrame(sleep=0.2),
        LLMContextAssistantTurnFrame(text='hel', timestamp=''),
        InterruptionFrame(),
        LLMContextAssistantTurnFrame(text='', timestamp=''),
        agent_id='c1',
    )
    assert core.requests == [
        ('/user-turns', {'text': 'hello choir', 'early': False, 'voice': True})
    ]


async def test_speaks_replies_again_after_a_switch_from_one_talked_over(
    core: RecordingCore,
) -> None:
    core.voice_events = [reply('Once'), 0.2, agent('c2'), reply('Bye'), REPLY_END]
    down = await run(
        core,
        SleepFrame(sleep=0.1),
        InterruptionFrame(),
        SleepFrame(sleep=0.3),
        agent_id='c1',
    )
    assert spoken(down)[-3:] == [
        LLMFullResponseStartFrame,
        'Bye',
        LLMFullResponseEndFrame,
    ]


async def test_ends_no_reply_the_user_talked_over(core: RecordingCore) -> None:
    core.voice_events = [reply('Once'), 0.2, REPLY_END]
    down = await run(
        core,
        SleepFrame(sleep=0.1),
        InterruptionFrame(),
        SleepFrame(sleep=0.3),
        agent_id='c1',
    )
    assert LLMFullResponseEndFrame not in spoken(down)
