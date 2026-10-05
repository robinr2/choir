import { z } from 'zod';
import type {
  ElicitationField,
  ElicitationPart,
  QuestionItem,
} from './transcript.js';

const optionSchema = z.object({
  const: z.string(),
  title: z.string(),
  description: z.string().nullish(),
});

const propertySchema = z.looseObject({
  type: z.string(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  enum: z.array(z.string()).nullish(),
  oneOf: z.array(optionSchema).nullish(),
  items: z
    .looseObject({
      enum: z.array(z.string()).optional(),
      anyOf: z.array(optionSchema).optional(),
    })
    .optional(),
});

type Property = z.infer<typeof propertySchema>;

type Option = z.infer<typeof optionSchema>;

export const requestSchema = z.looseObject({
  message: z.string(),
  mode: z.string(),
  sessionId: z.string().optional(),
  toolCallId: z.string().nullish(),
  url: z.string().optional(),
  requestedSchema: z
    .looseObject({
      properties: z.record(z.string(), propertySchema).default({}),
      required: z.array(z.string()).nullish(),
    })
    .optional(),
});

export type ElicitationRequest = z.infer<typeof requestSchema>;

const QUESTION = /^question_\d+$/;

const KINDS: Record<string, ElicitationField['kind']> = {
  boolean: 'toggle',
  number: 'number',
  integer: 'number',
};

function choices({ oneOf, items }: Property): Option[] {
  return oneOf ?? items?.anyOf ?? [];
}

function values(property: Property): string[] {
  const titled = choices(property).map((option) => option.const);
  return [...titled, ...(property.enum ?? property.items?.enum ?? [])];
}

function properties(request: ElicitationRequest): [string, Property][] {
  return Object.entries(request.requestedSchema?.properties ?? {});
}

function field(
  [name, property]: [string, Property],
  required: ReadonlySet<string>,
): ElicitationField {
  const options = values(property);
  const kind = KINDS[property.type] ?? (options.length > 0 ? 'choice' : 'text');
  return {
    name,
    label: property.title ?? name,
    kind,
    ...(kind === 'choice' && { options }),
    required: required.has(name),
  };
}

function linked(request: ElicitationRequest) {
  const { mode, url } = request;
  if (mode !== 'url' || url === undefined) return { mode: 'form' as const };
  return { mode: 'url' as const, url };
}

export function elicitationPart(
  id: string,
  request: ElicitationRequest,
): ElicitationPart {
  const required = new Set(request.requestedSchema?.required);
  return {
    type: 'elicitation',
    id,
    server: null,
    message: request.message,
    ...linked(request),
    fields: properties(request).map((entry) => field(entry, required)),
    state: 'request',
  };
}

function choiceOf({ const: id, title, description }: Option) {
  return { id, label: title, ...(description && { description }) };
}

export function questionsOf(request: ElicitationRequest): QuestionItem[] {
  const all = new Map(properties(request));
  return [...all].flatMap(([id, property]) => {
    if (!QUESTION.test(id)) return [];
    const freeform = `${id}_custom`;
    return [
      {
        id,
        header: property.title ?? id,
        prompt: property.description ?? request.message,
        options: choices(property).map(choiceOf),
        multiple: property.type === 'array',
        freeform: all.has(freeform) ? freeform : null,
      },
    ];
  });
}
