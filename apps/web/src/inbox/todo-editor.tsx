import {
  type ChangeEvent,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
  useCallback,
  useId,
  useReducer,
  useTransition,
} from 'react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fromLocalInput, localInput } from './inbox-time';
import type { TodoDraft } from './core-inbox';

type Fields = { title: string; description: string; dueAt: string };

type FieldEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

type Editing = Readonly<{
  fields: Fields;
  onChange: (event: FieldEvent) => void;
}>;

function changed(fields: Fields, event: FieldEvent): Fields {
  return { ...fields, [event.target.name]: event.target.value };
}

function initial({ title, description, dueAt }: TodoDraft): Fields {
  return { title, description, dueAt: localInput(dueAt) };
}

function TextField({
  label,
  ...input
}: Readonly<{ label: string } & ComponentProps<typeof Input>>) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <Input id={id} {...input} />
    </>
  );
}

function DescriptionField({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (event: FieldEvent) => void }>) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="text-xs font-medium">
        Description
      </label>
      <Textarea
        id={id}
        name="description"
        rows={6}
        value={value}
        onChange={onChange}
      />
    </>
  );
}

function TodoFields({ fields, onChange }: Editing) {
  return (
    <>
      <TextField
        label="Title"
        name="title"
        required
        maxLength={200}
        value={fields.title}
        onChange={onChange}
      />
      <DescriptionField value={fields.description} onChange={onChange} />
      <TextField
        label="Due"
        name="dueAt"
        type="datetime-local"
        value={fields.dueAt}
        onChange={onChange}
      />
    </>
  );
}

function SaveFooter({ saving }: Readonly<{ saving: boolean }>) {
  return (
    <DialogFooter className="mt-2">
      <Button type="submit" disabled={saving}>
        Save
      </Button>
    </DialogFooter>
  );
}

export function TodoEditor({
  draft,
  save,
  children,
}: Readonly<{
  draft: TodoDraft;
  save: (draft: TodoDraft) => Promise<void>;
  children?: ReactNode;
}>) {
  const [fields, change] = useReducer(changed, draft, initial);
  const [saving, startSaving] = useTransition();
  const submit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      startSaving(() =>
        save({ ...fields, dueAt: fromLocalInput(fields.dueAt) }),
      );
    },
    [fields, save],
  );
  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <TodoFields fields={fields} onChange={change} />
      {children}
      <SaveFooter saving={saving} />
    </form>
  );
}
