import { firstValueFrom, Subject, take, toArray } from 'rxjs';
import { type VoiceEvent, VoiceService } from './voice.service.js';

let voice: VoiceService;

function received(): VoiceEvent[] {
  const events: VoiceEvent[] = [];
  voice.events().subscribe((event) => events.push(event));
  return events;
}

beforeEach(() => {
  voice = new VoiceService();
});

it('points voice at one agent at a time', async () => {
  expect(await firstValueFrom(voice.changes)).toBeNull();
  voice.activate('a');
  expect(voice.isActive('a')).toBe(true);
  voice.activate('b');
  expect(voice.isActive('a')).toBe(false);
  expect(voice.isActive('b')).toBe(true);
  voice.activate(null);
  expect(voice.isActive('b')).toBe(false);
});

it('announces only real changes of the voice agent', async () => {
  const changes = firstValueFrom(voice.changes.pipe(take(3), toArray()));
  voice.activate('a');
  voice.activate('a');
  voice.activate(null);
  expect(await changes).toEqual([null, 'a', null]);
});

it('tells the voice app which agent to talk to', () => {
  voice.activate('a');
  const events = received();
  voice.activate('b');
  expect(events).toEqual([
    { type: 'agent', agentId: 'a' },
    { type: 'agent', agentId: 'b' },
  ]);
});

it('streams a reply of the voice agent to the voice app until it ends', () => {
  voice.activate('a');
  const events = received();
  const answer = new Subject<string>();
  voice.speak('a', answer);
  answer.next('Hel');
  answer.next('lo.');
  answer.complete();
  expect(events.slice(1)).toEqual([
    { type: 'reply', text: 'Hel' },
    { type: 'reply', text: 'lo.' },
    { type: 'reply-end' },
  ]);
});

it('stops streaming a reply once voice moves to another agent', () => {
  voice.activate('a');
  const events = received();
  const answer = new Subject<string>();
  voice.speak('a', answer);
  answer.next('Hel');
  voice.activate('b');
  voice.activate('a');
  answer.next('lo.');
  answer.complete();
  expect(events).toEqual([
    { type: 'agent', agentId: 'a' },
    { type: 'reply', text: 'Hel' },
    { type: 'agent', agentId: 'b' },
    { type: 'agent', agentId: 'a' },
  ]);
});

it('speaks nothing for an agent that voice is not pointed at', () => {
  voice.activate('a');
  const events = received();
  voice.speak('b', new Subject<string>());
  expect(events).toEqual([{ type: 'agent', agentId: 'a' }]);
});

it('turns voice off when the voice connection ends', () => {
  voice.activate('a');
  const connection = voice.events().subscribe();
  connection.unsubscribe();
  expect(voice.isActive('a')).toBe(false);
});

it('turns voice off when the connection ends after voice moved to another agent', () => {
  voice.activate('a');
  const connection = voice.events().subscribe();
  voice.activate('b');
  connection.unsubscribe();
  expect(voice.isActive('b')).toBe(false);
});

it('keeps voice on when an older voice connection ends', () => {
  voice.activate('a');
  const older = voice.events().subscribe();
  const newer = voice.events().subscribe();
  older.unsubscribe();
  expect(voice.isActive('a')).toBe(true);
  newer.unsubscribe();
  expect(voice.isActive('a')).toBe(false);
});

it('lets a connection end without turning voice back off once it was turned off', () => {
  voice.activate('a');
  const connection = voice.events().subscribe();
  voice.activate(null);
  voice.activate('b');
  connection.unsubscribe();
  expect(voice.isActive('b')).toBe(true);
});
