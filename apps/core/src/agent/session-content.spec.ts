import { promptBlocks } from './session-content.js';

const IMAGE = { data: 'aGk=', mimeType: 'image/png' };

it('sends only the images of a turn without text', () => {
  expect(promptBlocks({ text: '', images: [IMAGE] })).toEqual([
    { type: 'image', ...IMAGE },
  ]);
  expect(promptBlocks({ text: 'look' })).toEqual([
    { type: 'text', text: 'look' },
  ]);
});
