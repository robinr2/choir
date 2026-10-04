import {
  interactionAnswerSchema,
  settingsSchema,
  steeringSchema,
  userTurnSchema,
} from './conversations.schemas.js';

function accepts(schema: { safeParse(value: unknown): { success: boolean } }) {
  return (value: unknown) => schema.safeParse(value).success;
}

function image(data: string, mimeType: string) {
  return { text: 'look', images: [{ data, mimeType }] };
}

it('takes text with images and refuses anything else as an image', () => {
  const turn = accepts(userTurnSchema);
  expect(turn(image('aGk=', 'image/png'))).toBe(true);
  expect(turn(image('aGk=', 'image/svg+xml'))).toBe(true);
  expect(turn(image('', 'image/png'))).toBe(false);
  expect(turn(image('not base64!', 'image/png'))).toBe(false);
  expect(turn(image('aGk=', 'text/plain'))).toBe(false);
  expect(turn(image('aGk=', 'ximage/png'))).toBe(false);
  expect(turn(image('aGk=', 'image/png x'))).toBe(false);
  expect(turn(image('aGk=', 'image/'))).toBe(false);
  expect(turn({ text: ' ', early: true })).toBe(false);
  expect(turn({ text: 'hi', voice: 'yes' })).toBe(false);
  expect(steeringSchema.parse({ text: ' hi ' })).toEqual({ text: 'hi' });
});

it('takes an option, an action with content, or a plain action as an answer', () => {
  const answer = accepts(interactionAnswerSchema);
  expect(answer({ optionId: 'yes' })).toBe(true);
  expect(answer({ optionId: '' })).toBe(false);
  expect(answer({ optionId: 'yes', action: 'accept' })).toBe(false);
  expect(
    answer({
      action: 'accept',
      content: { a: 'b', c: ['d'], e: true, f: 1 },
    }),
  ).toBe(true);
  expect(answer({ action: 'accept', content: { a: { b: 1 } } })).toBe(false);
  expect(answer({ action: 'decline' })).toBe(true);
  expect(answer({ action: 'cancel', content: {} })).toBe(false);
  expect(answer({ action: 'maybe' })).toBe(false);
});

it('takes at least one setting to change', () => {
  const settings = accepts(settingsSchema);
  expect(settings({ model: 'opus' })).toBe(true);
  expect(settingsSchema.parse({ effort: ' high ' })).toEqual({
    effort: 'high',
  });
  expect(settingsSchema.safeParse({}).error?.issues[0]?.message).toBe(
    'Name a setting to change',
  );
  expect(settings({ mode: ' ' })).toBe(false);
  expect(settings({ fast: true })).toBe(false);
});
