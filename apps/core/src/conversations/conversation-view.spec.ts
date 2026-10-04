import { newModel, stateOf } from './conversation-model.js';
import { ConversationView } from './conversation-view.js';

it('publishes a state only when the model changes', () => {
  const view = new ConversationView(newModel(1), stateOf);
  const seen: unknown[] = [];
  view.changes.subscribe((state) => seen.push(state));
  view.change((model) => model);
  view.change((model) => ({ ...model, queue: [] }));
  expect(seen).toHaveLength(2);
  view.complete();
  expect(view.state).toBe(seen[1]);
});
