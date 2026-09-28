import { z } from 'zod';
import { entryIdSchema } from '../inbox/listing.js';
import { reply, type Tool, type ToolContext } from './tools.js';

type Archiving = {
  noun: string;
  name: string;
  key: string;
  archive: (
    context: ToolContext,
    id: string,
    archived: boolean,
  ) => Promise<unknown>;
};

function archiveTool(
  { noun, name, key, archive }: Archiving,
  archived: boolean,
): Tool {
  const description = archived
    ? `Archive a ${noun}, which takes it out of the user's active list.`
    : `Take a ${noun} out of the archive and back into the user's active list.`;
  return (server, context) => {
    server.registerTool(
      `${archived ? '' : 'un'}archive_${name}`,
      {
        description,
        inputSchema: z.object({
          [key]: entryIdSchema.describe(`The ID of the ${noun}`),
        }),
      },
      async (input: Record<string, string>) => {
        await archive(context, input[key], archived);
        return reply({ archived });
      },
    );
  };
}

export function archiveTools(archiving: Archiving): Tool[] {
  return [archiveTool(archiving, true), archiveTool(archiving, false)];
}
