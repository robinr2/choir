import type {
  AppendMessage,
  ExternalThreadQueueAdapter,
  QueueItemState,
} from '@assistant-ui/react';
import type {
  CoreConversation,
  Image,
  QueuedTurn,
  Turn,
} from '@/conversation/core-conversation';

type Part = AppendMessage['content'][number];

const DATA_URL = /^data:([^;]+);base64,(.*)/s;

const RESUME = '/resume';

function imagesIn(parts: readonly Part[]): Image[] {
  return parts.flatMap((part) => {
    const match = part.type === 'image' ? DATA_URL.exec(part.image) : null;
    return match ? [{ mimeType: match[1], data: match[2] }] : [];
  });
}

export function turnOf({ content, attachments = [] }: AppendMessage): Turn {
  const parts = [...content, ...attachments.flatMap((file) => file.content)];
  const text = parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');
  return { text, images: imagesIn(parts) };
}

export type ChatQueue = ExternalThreadQueueAdapter & {
  submit: (message: AppendMessage) => Promise<void>;
};

const QUEUED_IMAGE = {
  type: 'file',
  filename: 'image',
  data: '',
  mimeType: 'image/*',
} as const;

function itemOf({ id, text, images }: QueuedTurn): QueueItemState {
  return {
    id,
    prompt: text,
    parts: [
      { type: 'text', text },
      ...Array.from({ length: images }, () => QUEUED_IMAGE),
    ],
  };
}

export function chatQueueOf(
  conversation: CoreConversation,
  queue: readonly QueuedTurn[],
  onResume: (open: true) => void,
): ChatQueue {
  const submit = async (message: AppendMessage) => {
    const turn = turnOf(message);
    if (turn.text.trim() === RESUME) onResume(true);
    else await conversation.send(turn);
  };
  return {
    items: queue.map(itemOf),
    steerItems: [],
    submit,
    enqueue: (message) => void submit(message),
    steer: (message) => void conversation.steer(turnOf(message)),
    move: (id, { lane }) => {
      if (lane !== 'steer') throw new Error('Queued turns keep their order');
      void conversation.steerQueued(id);
    },
    edit: () => {
      throw new Error('Queued turns cannot be edited');
    },
    remove: (id) => void conversation.unqueue(id),
  };
}
