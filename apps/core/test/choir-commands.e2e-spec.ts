import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { SessionListing } from '../src/agent/agent-catalog.js';
import { TestApp } from './test-app.js';

const testApp = TestApp.use();

async function sessions(): Promise<SessionListing[]> {
  const { body } = await request(testApp.app.getHttpServer())
    .get('/agent-sessions')
    .expect(200);
  return body;
}

async function sessionId(): Promise<string> {
  const { session } = await testApp.conversation.state();
  if (!session) throw new Error('The conversation has no session');
  return session.id;
}

it('hands a subtask to a background subagent and shows what the user typed', async () => {
  const { conversation } = testApp;
  const { text } = await conversation.say('/subtask write the tests');
  expect(text).toContain('subagent_type \\"fork\\"');
  expect(text).toContain('write the tests');
  expect(await conversation.userTexts()).toEqual(['/subtask write the tests']);
  const reopened = await testApp.reopen();
  expect(await reopened.userTexts()).toEqual(['/subtask write the tests']);
});

it('branches the conversation into a new session and keeps the original', async () => {
  const { conversation } = testApp;
  await conversation.say('echo hi');
  const original = await sessionId();
  const { text } = await conversation.say('/branch feature');
  expect(text).toBe('');
  const branched = await conversation.until(
    ({ session, status }) =>
      session?.id !== original && status.state === 'idle',
  );
  expect(await conversation.userTexts()).toEqual([
    'echo hi',
    '/rename feature',
  ]);
  expect(branched.session?.cwd).toBe((await sessions())[0]?.cwd);
  expect((await sessions()).map((listed) => listed.sessionId)).toContain(
    original,
  );
  await conversation.say('/branch');
  await conversation.until(
    ({ session }) => session?.id !== branched.session?.id,
  );
  const reopened = await testApp.reopen();
  expect(await reopened.userTexts()).toEqual(['echo hi', '/rename feature']);
});

it('forks the conversation into a background conversation and lists it', async () => {
  const { conversation } = testApp;
  await conversation.say('echo hi');
  await conversation.say('/fork echo forked');
  const { forks } = await conversation.until(
    (state) => state.forks[0]?.state === 'ready',
  );
  expect(forks).toEqual([
    {
      id: expect.any(String),
      sessionId: expect.any(String),
      title: 'echo forked',
      state: 'ready',
      startedAt: expect.any(Number),
      endedAt: expect.any(Number),
    },
  ]);
  const fork = testApp.talkTo(forks[0]?.id ?? '');
  expect(await fork.userTexts()).toEqual(['echo hi', 'echo forked']);
  expect((await fork.state()).session?.id).toBe(forks[0]?.sessionId);
  await conversation.say('/fork');
  await conversation.until((state) => state.forks.length === 2);
  expect(await conversation.userTexts()).toEqual(['echo hi']);
});

it('resumes another session in the conversation', async () => {
  const { conversation } = testApp;
  const other = testApp.talkTo(randomUUID());
  await other.say('echo elsewhere');
  const otherSession = (await other.state()).session?.id;
  await conversation.say('echo here');
  await conversation.say(`/resume ${otherSession}`);
  expect((await conversation.state()).session?.id).toBe(otherSession);
  expect(await conversation.userTexts()).toEqual(['echo elsewhere']);
  const turn = (text: string) => conversation.post('user-turns', { text });
  await turn('/resume').expect(400);
  await turn(`/resume ${randomUUID()}`).expect(404);
  await turn('/subtask').expect(400);
});
