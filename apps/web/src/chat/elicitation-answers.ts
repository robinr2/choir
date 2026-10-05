import type { ElicitationField } from '@/components/assistant-ui/elements/elicitation-form';
import type { Answer } from '@/conversation/core-conversation';
import type { ElicitationPart } from '@/conversation/transcript';

type Field = ElicitationPart['fields'][number];

export type Values = Readonly<Record<string, string>>;

type Value = string | boolean | number;

export function initialValues(fields: readonly Field[]): Values {
  return Object.fromEntries(
    fields.map(({ name, kind }) => [name, kind === 'toggle' ? 'false' : '']),
  );
}

export function shownFields(
  fields: readonly Field[],
  values: Values,
): ElicitationField[] {
  return fields.map(({ name, label, kind, options, required }) => ({
    name,
    label,
    kind,
    required,
    value: values[name] ?? '',
    ...(options && { options }),
  }));
}

function valueOf({ kind }: Field, value: string): Value {
  if (kind === 'toggle') return value === 'true';
  return kind === 'number' ? Number(value) : value;
}

export function acceptance(fields: readonly Field[], values: Values): Answer {
  const content = Object.fromEntries(
    fields.flatMap((field): [string, Value][] => {
      const value = values[field.name] ?? '';
      return value === '' ? [] : [[field.name, valueOf(field, value)]];
    }),
  );
  return { action: 'accept', content };
}
