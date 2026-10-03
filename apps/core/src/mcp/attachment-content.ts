import type { LinkedFile } from '../inbox/notification-views.js';

function base64(content: Uint8Array): string {
  return Buffer.from(content).toString('base64');
}

function attachmentContent(coreUrl: string, file: LinkedFile) {
  const data = base64(file.content);
  if (file.mediaType.startsWith('image/')) {
    return { type: 'image' as const, data, mimeType: file.mediaType };
  }
  return {
    type: 'resource' as const,
    resource: {
      uri: `${coreUrl}/notifications/${file.notificationId}/attachments/${file.index}`,
      mimeType: file.mediaType,
      blob: data,
    },
  };
}

export function grabbed(
  coreUrl: string,
  entry: object,
  files: readonly LinkedFile[],
) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(entry) },
      ...files.map((file) => attachmentContent(coreUrl, file)),
    ],
  };
}
