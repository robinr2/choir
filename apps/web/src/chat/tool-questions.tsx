import { type ChangeEvent, useCallback, useState } from 'react';
import { OptionList } from '@/components/assistant-ui/elements/option-list';
import { Input } from '@/components/ui/input';
import type { Question, QuestionItem } from '@/conversation/transcript';
import type { Answering } from './answering';
import {
  contentOf,
  isAnswered,
  type Picks,
  type Typed,
} from './question-answers';
import { Heading, Receipt } from './question-receipt';

type QuestionsProps = Readonly<{ question: Question; answering: Answering }>;

type TypeAnswer = (event: ChangeEvent<HTMLInputElement>) => void;

type OpenProps = Readonly<{
  item: QuestionItem;
  onPick: (id: string, picked: string[]) => void;
  onType: TypeAnswer;
}>;

function OpenQuestion({ item, onPick, onType }: OpenProps) {
  const [confirm] = useState(
    () => (picked: string[]) => onPick(item.id, picked),
  );
  return (
    <div className="flex flex-col gap-1.5">
      <Heading item={item} />
      <OptionList
        aria-label={item.prompt}
        options={item.options}
        selectionMode={item.multiple ? 'multiple' : 'single'}
        onConfirm={confirm}
        className="max-w-none"
      />
      {item.freeform && (
        <Input
          name={item.id}
          aria-label={`Other answer to ${item.header}`}
          placeholder="Other…"
          onChange={onType}
        />
      )}
    </div>
  );
}

function useDraft() {
  const [picks, setPicks] = useState<Picks>({});
  const [typed, setTyped] = useState<Typed>({});
  const [handlers] = useState(() => ({
    pick: (id: string, picked: string[]) =>
      setPicks((all) => ({ ...all, [id]: picked })),
    type: ({ target }: ChangeEvent<HTMLInputElement>) =>
      setTyped((all) => ({ ...all, [target.name]: target.value })),
  }));
  return { picks, typed, ...handlers };
}

function QuestionActions({
  ready,
  onSend,
  onDecline,
}: Readonly<{ ready: boolean; onSend: () => void; onDecline: () => void }>) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onDecline}
        className="text-foreground/45 hover:bg-foreground/[0.06] hover:text-foreground/90 h-8 rounded-full px-3.5 text-xs font-medium transition-colors"
      >
        Decline
      </button>
      <button
        type="button"
        disabled={!ready}
        onClick={onSend}
        className="bg-foreground text-background h-8 rounded-full px-3.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Send answers
      </button>
    </div>
  );
}

function useReplies(
  { question, answering }: QuestionsProps,
  picks: Picks,
  typed: Typed,
) {
  const { id, questions } = question;
  const send = useCallback(
    () =>
      answering.reply(id, {
        action: 'accept',
        content: contentOf(questions, picks, typed),
      }),
    [answering, id, questions, picks, typed],
  );
  const [decline] = useState(
    () => () => answering.reply(id, { action: 'decline' }),
  );
  return { send, decline };
}

function QuestionForm(props: QuestionsProps) {
  const { questions } = props.question;
  const { picks, typed, pick, type } = useDraft();
  const { send, decline } = useReplies(props, picks, typed);
  return (
    <fieldset
      aria-label="Questions from the agent"
      className="bg-background border-border/60 dark:bg-popover my-1 flex w-full flex-col gap-4 rounded-[20px] border p-4"
    >
      {questions.map((item) => (
        <OpenQuestion key={item.id} item={item} onPick={pick} onType={type} />
      ))}
      <QuestionActions
        ready={isAnswered(questions, picks, typed)}
        onSend={send}
        onDecline={decline}
      />
    </fieldset>
  );
}

export function ToolQuestions(props: QuestionsProps) {
  const { question } = props;
  if (question.answers || question.resolution) {
    return <Receipt question={question} />;
  }
  return <QuestionForm {...props} />;
}
