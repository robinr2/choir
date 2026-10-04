import {
  elicitationPart,
  questionsOf,
  requestSchema,
} from './elicitation-schema.js';

function request(value: object) {
  return requestSchema.parse({ message: 'Fill in', mode: 'form', ...value });
}

it('describes the fields of a form', () => {
  const form = request({
    requestedSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name' },
        color: { type: 'string', enum: ['red', 'blue'] },
        size: {
          type: 'string',
          oneOf: [
            { const: 's', title: 'Small' },
            { const: 'l', title: 'Large' },
          ],
        },
        tags: { type: 'array', items: { anyOf: [{ const: 'a', title: 'A' }] } },
        flavors: { type: 'array', items: { type: 'string', enum: ['x'] } },
        ok: { type: 'boolean' },
        count: { type: 'integer' },
        ratio: { type: 'number' },
      },
      required: ['name', 'count'],
    },
  });
  expect(elicitationPart('e1', form)).toEqual({
    type: 'elicitation',
    id: 'e1',
    server: null,
    message: 'Fill in',
    mode: 'form',
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true },
      {
        name: 'color',
        label: 'color',
        kind: 'choice',
        options: ['red', 'blue'],
        required: false,
      },
      {
        name: 'size',
        label: 'size',
        kind: 'choice',
        options: ['s', 'l'],
        required: false,
      },
      {
        name: 'tags',
        label: 'tags',
        kind: 'choice',
        options: ['a'],
        required: false,
      },
      {
        name: 'flavors',
        label: 'flavors',
        kind: 'choice',
        options: ['x'],
        required: false,
      },
      { name: 'ok', label: 'ok', kind: 'toggle', required: false },
      { name: 'count', label: 'count', kind: 'number', required: true },
      { name: 'ratio', label: 'ratio', kind: 'number', required: false },
    ],
    state: 'request',
  });
});

it('shows a link to open and a form without a schema', () => {
  expect(
    elicitationPart('e2', request({ mode: 'url', url: 'https://example.com' })),
  ).toEqual({
    type: 'elicitation',
    id: 'e2',
    server: null,
    message: 'Fill in',
    mode: 'url',
    url: 'https://example.com',
    fields: [],
    state: 'request',
  });
  expect(elicitationPart('e3', request({ mode: 'url' }))).toMatchObject({
    mode: 'form',
    fields: [],
  });
  expect(
    elicitationPart('e4', request({ url: 'https://example.com' })),
  ).not.toHaveProperty('url');
  expect(
    elicitationPart('e5', request({ requestedSchema: { required: null } })),
  ).toMatchObject({ fields: [] });
});

it('reads the questions of the agent with their options and free text', () => {
  const asked = request({
    message: 'Please answer the following questions.',
    requestedSchema: {
      type: 'object',
      properties: {
        question_0: {
          type: 'string',
          title: 'Database',
          description: 'Which database?',
          oneOf: [
            { const: 'Postgres', title: 'Postgres', description: 'Relational' },
            { const: 'Redis', title: 'Redis', description: null },
          ],
        },
        question_0_custom: { type: 'string', title: 'Other' },
        question_1: {
          type: 'array',
          items: { anyOf: [{ const: 'Fast', title: 'Fast' }] },
        },
        question_12: { type: 'string' },
        my_question_3: { type: 'string' },
        note: { type: 'string' },
      },
    },
  });
  expect(questionsOf(asked)).toEqual([
    {
      id: 'question_0',
      header: 'Database',
      prompt: 'Which database?',
      options: [
        { id: 'Postgres', label: 'Postgres', description: 'Relational' },
        { id: 'Redis', label: 'Redis' },
      ],
      multiple: false,
      freeform: 'question_0_custom',
    },
    {
      id: 'question_1',
      header: 'question_1',
      prompt: 'Please answer the following questions.',
      options: [{ id: 'Fast', label: 'Fast' }],
      multiple: true,
      freeform: null,
    },
    {
      id: 'question_12',
      header: 'question_12',
      prompt: 'Please answer the following questions.',
      options: [],
      multiple: false,
      freeform: null,
    },
  ]);
  expect(questionsOf(request({}))).toEqual([]);
});
