import { PaperclipIcon } from 'lucide-react';
import { attachmentUrl, type LinkedAttachment } from './core-inbox';

type Files = Readonly<{ files: readonly LinkedAttachment[] }>;

function urlOf(file: LinkedAttachment): string {
  return attachmentUrl(file.notificationId, file.index);
}

function isImage(file: LinkedAttachment): boolean {
  return file.mediaType.startsWith('image/');
}

function FileLink({ file }: Readonly<{ file: LinkedAttachment }>) {
  return (
    <a
      href={urlOf(file)}
      target="_blank"
      rel="noreferrer"
      className="text-primary inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
    >
      <PaperclipIcon className="size-3.5" aria-hidden />
      {file.filename}
    </a>
  );
}

function FileList({ files }: Files) {
  const others = files.filter((file) => !isImage(file));
  if (others.length === 0) return null;
  return (
    <ul aria-label="Attachments" className="flex flex-col gap-1">
      {others.map((file) => (
        <li key={urlOf(file)}>
          <FileLink file={file} />
        </li>
      ))}
    </ul>
  );
}

export function Attachments({ files }: Files) {
  return (
    <>
      {files.filter(isImage).map((file) => (
        <img
          key={urlOf(file)}
          src={urlOf(file)}
          alt={file.filename}
          className="max-w-full rounded-md border"
        />
      ))}
      <FileList files={files} />
    </>
  );
}
