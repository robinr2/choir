from typing import Any

from pipecat.frames.frames import (
    CancelFrame,
    EagerTranscriptionFrame,
    EndFrame,
    Frame,
    ProposedUserStartedSpeakingFrame,
    ProposedUserStoppedSpeakingFrame,
    StartFrame,
    TranscriptionFrame,
)
from pipecat.processors.frame_processor import (
    FrameDirection,
    FrameProcessor,
    FrameProcessorSetup,
)
from pipecat.turns.user_turn_controller import UserTurnController
from pipecat.turns.user_turn_strategies import UserTurnStrategies


def eager_transcript(frame: TranscriptionFrame) -> EagerTranscriptionFrame:
    return EagerTranscriptionFrame(
        text=frame.text,
        user_id=frame.user_id,
        timestamp=frame.timestamp,
        language=frame.language,
    )


class EagerEndOfTurn(FrameProcessor):
    def __init__(self, user_turn_strategies: UserTurnStrategies | None = None) -> None:
        super().__init__()  # pyright: ignore[reportUnknownMemberType]
        self._turns = UserTurnController(
            user_turn_strategies=user_turn_strategies or UserTurnStrategies()
        )
        self._turns.event_handler('on_push_frame')(self._on_push_frame)
        self._turns.event_handler('on_broadcast_frame')(self._on_broadcast_frame)
        self._turns.event_handler('on_user_turn_started')(self._propose_start)
        self._turns.event_handler('on_user_turn_stopped')(self._propose_stop)

    async def setup(self, setup: FrameProcessorSetup) -> None:
        await super().setup(setup)
        await self._turns.setup(setup)

    async def cleanup(self) -> None:
        await super().cleanup()
        await self._turns.cleanup()

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)
        if isinstance(frame, TranscriptionFrame):
            await self.push_frame(eager_transcript(frame), direction)
        await self.push_frame(frame, direction)
        await self._follow(frame)
        await self._turns.process_frame(frame)

    async def _follow(self, frame: Frame) -> None:
        if isinstance(frame, StartFrame):
            await self._turns.start()
        elif isinstance(frame, EndFrame | CancelFrame):
            await self._turns.stop()

    async def _on_push_frame(
        self,
        _controller: UserTurnController,
        frame: Frame,
        direction: FrameDirection = FrameDirection.DOWNSTREAM,
    ) -> None:
        await self.push_frame(frame, direction)

    async def _on_broadcast_frame(
        self, _controller: UserTurnController, frame_cls: type[Frame], **kwargs: Any
    ) -> None:
        await self.broadcast_frame_instance(frame_cls(**kwargs))

    async def _propose_start(self, *_args: object) -> None:
        await self.broadcast_frame_instance(ProposedUserStartedSpeakingFrame())

    async def _propose_stop(self, *_args: object) -> None:
        await self.broadcast_frame_instance(ProposedUserStoppedSpeakingFrame())
