import httpx
import pytest

from tests.conftest import RecordingCore


async def test_streams_the_reply_to_the_user_turn(core: RecordingCore) -> None:
    chunks = [chunk async for chunk in core.conversation().reply_to('hello choir')]
    assert chunks == ['hello choir']
    assert core.requests == [('/conversation/user-turns', {'text': 'hello choir'})]
    assert core.methods == ['POST']


async def test_withdraws_the_latest_user_turn(core: RecordingCore) -> None:
    await core.conversation().withdraw()
    assert core.requests == [('/conversation/withdrawals', None)]


async def test_reports_what_was_heard_of_the_reply(core: RecordingCore) -> None:
    await core.conversation().interrupt('hello')
    assert core.requests == [('/conversation/interruptions', {'heard': 'hello'})]


async def test_fails_when_core_rejects_a_user_turn(core: RecordingCore) -> None:
    core.status = httpx.codes.BAD_REQUEST
    with pytest.raises(httpx.HTTPStatusError):
        [chunk async for chunk in core.conversation().reply_to('hello choir')]


async def test_fails_when_core_rejects_a_withdrawal(core: RecordingCore) -> None:
    core.status = httpx.codes.BAD_REQUEST
    with pytest.raises(httpx.HTTPStatusError):
        await core.conversation().withdraw()


async def test_fails_when_core_rejects_an_interruption(core: RecordingCore) -> None:
    core.status = httpx.codes.BAD_REQUEST
    with pytest.raises(httpx.HTTPStatusError):
        await core.conversation().interrupt('hello')
