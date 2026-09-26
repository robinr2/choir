from pipecat.frames.frames import (
    EagerEndOfTurnCancelFrame,
    Frame,
    InterruptionFrame,
    LLMContextAssistantTurnFrame,
    LLMContextFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.frame_processor import FrameDirection
from pipecat.services.llm_service import LLMService
from pipecat.services.settings import LLMSettings

from voice.core_conversation import CoreConversation

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
        self._interrupted_words = ''

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)
        if isinstance(frame, LLMContextFrame):
            await self._answer(frame)
            return
        await self._follow(frame)
        await self.push_frame(frame, direction)

    async def _follow(self, frame: Frame) -> None:
        if isinstance(frame, UserStoppedSpeakingFrame):
            self._early_words = ''
        elif isinstance(frame, InterruptionFrame):
            await self._interrupt()
        elif isinstance(frame, EagerEndOfTurnCancelFrame):
            await self._withdraw()
        elif isinstance(frame, LLMContextAssistantTurnFrame):
            await self._finish_reply(frame.text)

    async def _interrupt(self) -> None:
        await self._withdraw()
        self._interrupted_words = self._answered_words

    async def _answer(self, frame: LLMContextFrame) -> None:
        await self._finish_reply('')
        words = latest_user_words(frame.context)
        self._early_words = words if frame.speculation else ''
        self._answered_words = words
        await self.push_frame(LLMFullResponseStartFrame())
        if words:
            async for text in self._conversation.reply_to(words):
                await self._push_llm_text(text)
        await self.push_frame(LLMFullResponseEndFrame())

    async def _withdraw(self) -> None:
        if self._early_words == '':
            return
        self._early_words = ''
        self._answered_words = ''
        await self._conversation.withdraw()

    async def _finish_reply(self, heard: str) -> None:
        if self._interrupted_words != '':
            await self._conversation.interrupt(heard)
        self._interrupted_words = ''
        self._answered_words = ''
