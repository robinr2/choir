import { useCallback, useState } from 'react';
import type { DataMessagePartComponent } from '@assistant-ui/react';
import { ElicitationForm } from '@/components/assistant-ui/elements/elicitation-form';
import { useCoreConversation } from '@/conversation/conversation-context';
import type { ElicitationPart } from '@/conversation/transcript';
import {
  acceptance,
  initialValues,
  shownFields,
  type Values,
} from './elicitation-answers';

function linkOf({ url }: ElicitationPart) {
  return url ? { href: url, label: 'Open sign-in page' } : undefined;
}

function useAnswers(part: ElicitationPart, values: Values) {
  const conversation = useCoreConversation();
  const { id, fields } = part;
  const signIn = linkOf(part) !== undefined;
  const accept = useCallback(
    () =>
      void conversation.answer(
        id,
        signIn ? { action: 'accept' } : acceptance(fields, values),
      ),
    [conversation, id, signIn, fields, values],
  );
  const [decline] = useState(
    () => () => void conversation.answer(id, { action: 'decline' }),
  );
  return { accept, decline };
}

function Elicitation({ part }: Readonly<{ part: ElicitationPart }>) {
  const [values, setValues] = useState<Values>(() =>
    initialValues(part.fields),
  );
  const [change] = useState(
    () => (name: string, value: string) =>
      setValues((all) => ({ ...all, [name]: value })),
  );
  const { accept, decline } = useAnswers(part, values);
  return (
    <ElicitationForm
      server={part.server ?? 'Agent'}
      message={part.message}
      fields={shownFields(part.fields, values)}
      state={part.state}
      link={linkOf(part)}
      onChange={change}
      onAccept={accept}
      onDecline={decline}
      className="my-1 max-w-none"
    />
  );
}

export const ElicitationData: DataMessagePartComponent<ElicitationPart> = ({
  data,
}) => <Elicitation part={data} />;
