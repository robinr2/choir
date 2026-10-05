import { CheckIcon, XIcon } from 'lucide-react';
import { OptionList } from '@/components/assistant-ui/elements/option-list';
import type { Question, QuestionItem } from '@/conversation/transcript';
import { chosenIn, typedIn } from './question-answers';

const SETTLED = { declined: 'Declined', cancelled: 'Cancelled' } as const;

export function Heading({ item }: Readonly<{ item: QuestionItem }>) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-foreground/40 font-mono text-[11px] tracking-tight">
        {item.header}
      </span>
      <p className="text-[13.5px] font-medium">{item.prompt}</p>
    </div>
  );
}

function Answered({
  question,
  item,
}: Readonly<{ question: Question; item: QuestionItem }>) {
  const chosen = chosenIn(question, item);
  const typed = typedIn(question, item);
  return (
    <div className="flex flex-col gap-1.5">
      <Heading item={item} />
      {chosen.length > 0 && (
        <OptionList
          options={item.options}
          choice={chosen}
          className="max-w-none"
        />
      )}
      {typed && (
        <p className="text-foreground/70 px-2 text-[13.5px]">Other: {typed}</p>
      )}
    </div>
  );
}

export function Receipt({ question }: Readonly<{ question: Question }>) {
  const { resolution } = question;
  return (
    <section
      aria-label="Questions from the agent"
      className="bg-background border-border/60 dark:bg-popover my-1 flex w-full flex-col gap-4 rounded-[20px] border p-4"
    >
      {resolution === undefined &&
        question.questions.map((item) => (
          <Answered key={item.id} question={question} item={item} />
        ))}
      <output className="text-foreground/55 flex items-center gap-2 text-xs">
        {resolution ? (
          <XIcon className="size-3.5" />
        ) : (
          <CheckIcon className="size-3.5 text-emerald-500" />
        )}
        {resolution ? SETTLED[resolution] : 'Answered'}
      </output>
    </section>
  );
}
