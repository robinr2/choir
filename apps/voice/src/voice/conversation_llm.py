from typing import TYPE_CHECKING

from pipecat.frames.frames import (
    CancelFrame,
    EagerEndOfTurnCancelFrame,
    EndFrame,
    Frame,
    InterruptionFrame,
    LLMContextAssistantTurnFrame,
    LLMContextFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    StartFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.frame_processor import FrameDirection
from pipecat.services.llm_service import LLMService
from pipecat.services.settings import LLMSettings

from voice.core_conversation import AgentChanged, CoreConversation, Reply, VoiceEvent

if TYPE_CHECKING:
    import asyncio

NO_MODEL_SETTINGS = LLMSettings(
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


QUIET = 'quiet'
SPEAKING = 'speaking'
IGNORED = 'ignored'
REPLY = 'reply'


def latest_user_words(context: LLMContext) -> str:
    messages = context.get_messages()
    latest = messages[-1] if messages else None
    if not isinstance(latest, dict) or latest.get('role') != 'user':
        return ''
    content = latest.get('content')
    return content if isinstance(content, str) else ''


class ConversationLLMService(LLMService):
    def __init__(self, conversation: CoreConversation) -> None:
        super().__init__(settings=NO_MODEL_SETTINGS)  # pyright: ignore[reportUnknownMemberType]
        self._conversation = conversation
        self._early_words = ''
        self._answered_words = ''
        self._interrupted = ''
        self._reply = QUIET
        self._listener: asyncio.Task[None] | None = None

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)
        await self._follow_pipeline(frame)
        if isinstance(frame, LLMContextFrame):
            await self._answer(frame)
            return
        await self._follow(frame)
        await self.push_frame(frame, direction)

    async def _follow_pipeline(self, frame: Frame) -> None:
        if isinstance(frame, StartFrame):
            self._listener = self.create_task(self._listen())  # pyright: ignore[reportUnknownMemberType]
        elif isinstance(frame, EndFrame | CancelFrame):
            await self._stop_listening()

    async def _stop_listening(self) -> None:
        if self._listener is not None:
            self._listener.cancel()
            self._listener = None

    async def _listen(self) -> None:
        async for event in self._conversation.events():
            await self._on_voice_event(event)

    async def _on_voice_event(self, event: VoiceEvent) -> None:
        if isinstance(event, AgentChanged):
            await self._talk_to(event.agent_id)
        elif isinstance(event, Reply):
            await self._say(event.text)
        else:
            await self._end_reply()

    async def _talk_to(self, agent_id: str | None) -> None:
        if self._conversation.agent_id not in {None, agent_id}:
            await self._confirm()
            await self._fall_silent()
        self._conversation.agent_id = agent_id

    async def _fall_silent(self) -> None:
        self._answered_words = ''
        self._interrupted = ''
        self._reply = QUIET
        await self._start_interruption()
        await self.broadcast_interruption()

    async def _say(self, text: str) -> None:
        if self._reply == IGNORED:
            return
        if self._reply == QUIET:
            await self.push_frame(LLMFullResponseStartFrame())
        self._reply = SPEAKING
        await self._push_llm_text(text)

    async def _end_reply(self) -> None:
        if self._reply == SPEAKING:
            await self.push_frame(LLMFullResponseEndFrame())
        self._reply = QUIET

    async def _follow(self, frame: Frame) -> None:
        if isinstance(frame, UserStoppedSpeakingFrame):
            await self._confirm()
        elif isinstance(frame, InterruptionFrame):
            await self._interrupt()
        elif isinstance(frame, EagerEndOfTurnCancelFrame):
            await self._withdraw()
        elif isinstance(frame, LLMContextAssistantTurnFrame):
            await self._finish_reply(frame.text)

    async def _interrupt(self) -> None:
        await self._withdraw()
        self._interrupted = self._answered_words
        if self._reply == SPEAKING:
            self._interrupted = REPLY
            self._reply = IGNORED

    async def _answer(self, frame: LLMContextFrame) -> None:
        await self._finish_reply('')
        await self._withdraw()
        words = latest_user_words(frame.context)
        early = self._speculation_gate.is_speculating
        self._early_words = words if early else ''
        self._answered_words = words
        await self.push_frame(LLMFullResponseStartFrame())
        if words:
            async for text in self._conversation.reply_to(words, early=early):
                await self._push_llm_text(text)
        await self.push_frame(LLMFullResponseEndFrame())

    async def _confirm(self) -> None:
        words = self._early_words
        if words == '':
            return
        self._early_words = ''
        await self._conversation.confirm(words)

    async def _withdraw(self) -> None:
        if self._early_words == '':
            return
        self._early_words = ''
        self._answered_words = ''
        await self._conversation.withdraw()

    async def _finish_reply(self, heard: str) -> None:
        if self._interrupted.strip():
            await self._conversation.interrupt(heard)
        self._interrupted = ''
        self._answered_words = ''
