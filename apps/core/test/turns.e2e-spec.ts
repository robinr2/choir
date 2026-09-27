import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TestApp } from './test-app.js';

const DENIED = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      'The user had not finished speaking, so this answer was withdrawn.',
  },
};

const HOOK_INPUT = { session_id: 's1', hook_event_name: 'UserPromptSubmit' };

const testApp = TestApp.use();

function promptContext(additionalContext: string) {
  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    },
  };
}

async function contextOf(prompt: string): Promise<unknown> {
  const response = await testApp.conversation
    .post('prompt-contexts', { ...HOOK_INPUT, prompt })
    .expect(200);
  return response.body;
}

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
  const rest = conversation.say(
    'stream-sleep 20000 hello stream-sleep 1000 choir',
  );
  await conversation.waitForAnswer('choir');
  expect(await contextOf('stream-sleep 1000 choir')).toEqual(
    promptContext(
      "The user's last message was not finished. This message continues it.",
    ),
  );
  await rest;
  expect(await conversation.userTexts()).toEqual([
    'stream-sleep 20000 hello',
    'stream-sleep 1000 choir',
  ]);
});

it('cancels an interrupted turn and tells the agent what the user heard', async () => {
  const { conversation } = testApp;
  const running = conversation.say('stream-sleep 20000 Once upon a time');
  await conversation.waitForAnswer('Once upon a time');
  await conversation.post('interruptions', { heard: 'Once upon' }).expect(204);
  await running;
  const shorter = conversation.say('stream-sleep 1000 shorter please');
  await conversation.waitForAnswer('shorter please');
  expect(await contextOf('stream-sleep 1000 shorter please')).toEqual(
    promptContext(
      'The user interrupted your last answer after hearing only: "Once upon".',
    ),
  );
  await shorter;
  expect(await conversation.userTexts()).toEqual([
    'stream-sleep 20000 Once upon a time',
    'stream-sleep 1000 shorter please',
  ]);
});

it('gives the prompt hook the voice rules for turns that are spoken', async () => {
  const { conversation } = testApp;
  const running = Promise.resolve(
    conversation.post('user-turns', {
      text: 'stream-sleep 1000 spoken',
      voice: true,
    }),
  );
  await conversation.waitForAnswer('spoken');
  const typed = conversation.say('stream-sleep 1000 typed');
  const rules = await readFile(
    path.join(
      testApp.dataDir,
      'profiles',
      'default',
      'default-voice-prompt.md',
    ),
    'utf8',
  );
  expect(await contextOf('stream-sleep 1000 spoken')).toEqual(
    promptContext(rules),
  );
  expect(await contextOf('stream-sleep 1000 typed')).toEqual({});
  await conversation.post('prompt-contexts', HOOK_INPUT).expect(400);
  await running;
  await typed;
  const reopened = await testApp.reopen();
  const marks = (await reopened.messages()).map(({ role, spoken }) => [
    role,
    spoken,
  ]);
  expect(marks).toEqual([
    ['user', undefined],
    ['assistant', true],
    ['user', undefined],
    ['assistant', undefined],
  ]);
});
