import { TestApp } from './test-app.js';

const DENIED = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      'The user had not finished speaking, so this answer was withdrawn.',
  },
};

const testApp = TestApp.use();

async function toolCallDecision(): Promise<unknown> {
  const response = await testApp.conversation
    .post('tool-calls', { tool_name: 'Bash' })
    .expect(200);
  return response.body;
}

it('holds the tool calls of an early start until the turn is confirmed', async () => {
  const { conversation } = testApp;
  const running = conversation.say('stream-sleep 1000 thinking', true);
  await conversation.waitForAnswer('thinking');
  const decision = toolCallDecision();
  await conversation
    .post('confirmations', { text: 'stream-sleep 1000 thinking' })
    .expect(204);
  expect(await decision).toEqual({});
  expect((await running).text).toContain('data: {"text":"thinking"}');
});

it('lets the tool calls of a turn that did not start early through', async () => {
  const { conversation } = testApp;
  const running = conversation.say('stream-sleep 1000 thinking');
  await conversation.waitForAnswer('thinking');
  expect(await toolCallDecision()).toEqual({});
  await running;
  expect(await toolCallDecision()).toEqual(DENIED);
});

it('cancels a withdrawn early start and sends only the rest of the turn', async () => {
  const { conversation } = testApp;
  const running = conversation.say('stream-sleep 20000 hello', true);
  await conversation.waitForAnswer('hello');
  const decision = toolCallDecision();
  await conversation.post('withdrawals').expect(204);
  expect(await decision).toEqual(DENIED);
  await running;
  await conversation.say('stream-sleep 20000 hello choir');
  expect(await conversation.userTexts()).toEqual([
    'stream-sleep 20000 hello',
    '(The user was not finished and continues:) choir',
  ]);
});

it('cancels an interrupted turn and tells the agent what the user heard', async () => {
  const { conversation } = testApp;
  const running = conversation.say('stream-sleep 20000 Once upon a time');
  await conversation.waitForAnswer('Once upon a time');
  await conversation.post('interruptions', { heard: 'Once upon' }).expect(204);
  await running;
  await conversation.say('echo shorter please');
  expect(await conversation.userTexts()).toEqual([
    'stream-sleep 20000 Once upon a time',
    '(The user interrupted you after hearing only: "Once upon". They continue:) echo shorter please',
  ]);
});

it('tells the prompt hook which turns were spoken', async () => {
  const { conversation } = testApp;
  const running = Promise.resolve(
    conversation.post('user-turns', {
      text: 'stream-sleep 1000 spoken',
      voice: true,
    }),
  );
  await conversation.waitForAnswer('spoken');
  const typed = conversation.say('stream-sleep 1000 typed');
  const hookInput = { session_id: 's1', hook_event_name: 'UserPromptSubmit' };
  await conversation
    .post('voice-turns', { ...hookInput, prompt: 'stream-sleep 1000 spoken' })
    .expect(204);
  const notSpoken = await conversation
    .post('voice-turns', { ...hookInput, prompt: 'stream-sleep 1000 typed' })
    .expect(404);
  expect(notSpoken.body.message).toBe('The prompt is not from a voice turn');
  await conversation.post('voice-turns', hookInput).expect(400);
  await running;
  await typed;
  const reopened = await testApp.reopen();
  const marks = (await reopened.messages()).map(({ role, voice }) => [
    role,
    voice,
  ]);
  expect(marks).toEqual([
    ['user', true],
    ['assistant', true],
    ['user', undefined],
    ['assistant', undefined],
  ]);
});
