import httpx
import pytest

from tests.conftest import RecordingCore
from voice.core_conversation import AgentChanged, CoreConversation, Reply, ReplyEnd


async def test_asks_core_nothing_while_pointed_at_no_agent(
    core: RecordingCore,
) -> None:
    conversation = core.conversation(None)
    assert [chunk async for chunk in conversation.reply_to('hi', early=False)] == []
    await conversation.confirm('hi')
    await conversation.withdraw()
    await conversation.interrupt('hi')
    assert core.requests == []


async def test_talks_to_no_agent_until_core_names_one(core: RecordingCore) -> None:
    conversation = CoreConversation(
        httpx.AsyncClient(
            transport=httpx.MockTransport(core.handle), base_url='http://core'
        )
    )
    await conversation.confirm('hi')
    assert core.requests == []


async def test_follows_the_voice_events_of_core(core: RecordingCore) -> None:
    core.voice_events = [
        {'type': 'agent', 'agentId': 'c2'},
        {'type': 'reply', 'text': 'Hi'},
        {'type': 'reply-end'},
    ]
    events = [event async for event in core.conversation().events()]
    assert events == [
        AgentChanged.model_validate({'type': 'agent', 'agentId': 'c2'}),
        Reply(type='reply', text='Hi'),
        ReplyEnd(type='reply-end'),
    ]
    assert core.requests == []


async def test_fails_when_core_refuses_the_voice_events(core: RecordingCore) -> None:
    core.status = httpx.codes.BAD_REQUEST
    with pytest.raises(httpx.HTTPStatusError):
        [event async for event in core.conversation().events()]


async def test_streams_the_reply_to_the_user_turn(core: RecordingCore) -> None:
    conversation = core.conversation()
    chunks = [chunk async for chunk in conversation.reply_to('hi', early=False)]
    assert chunks == ['hi']
    early = [chunk async for chunk in conversation.reply_to('hello', early=True)]
    assert early == ['hello']
    assert core.requests == [
        ('/user-turns', {'text': 'hi', 'early': False, 'voice': True}),
        ('/user-turns', {'text': 'hello', 'early': True, 'voice': True}),
    ]
    assert core.methods == ['POST', 'POST']


async def test_confirms_the_turn_that_started_early(core: RecordingCore) -> None:
    await core.conversation().confirm('hello')
    assert core.requests == [('/confirmations', {'text': 'hello'})]
    assert core.methods == ['POST']


async def test_withdraws_the_latest_user_turn(core: RecordingCore) -> None:
    await core.conversation().withdraw()
    assert core.requests == [('/withdrawals', None)]


async def test_reports_what_was_heard_of_the_reply(core: RecordingCore) -> None:
    await core.conversation().interrupt('hello')
    assert core.requests == [('/interruptions', {'heard': 'hello'})]


async def test_fails_when_core_rejects_a_user_turn(core: RecordingCore) -> None:
    core.status = httpx.codes.BAD_REQUEST
    with pytest.raises(httpx.HTTPStatusError):
        [chunk async for chunk in core.conversation().reply_to('hi', early=False)]


async def test_fails_when_core_rejects_a_confirmation(core: RecordingCore) -> None:
    core.status = httpx.codes.BAD_REQUEST
    with pytest.raises(httpx.HTTPStatusError):
        await core.conversation().confirm('hello')


async def test_fails_when_core_rejects_a_withdrawal(core: RecordingCore) -> None:
    core.status = httpx.codes.BAD_REQUEST
    with pytest.raises(httpx.HTTPStatusError):
        await core.conversation().withdraw()


async def test_fails_when_core_rejects_an_interruption(core: RecordingCore) -> None:
    core.status = httpx.codes.BAD_REQUEST
    with pytest.raises(httpx.HTTPStatusError):
        await core.conversation().interrupt('hello')
