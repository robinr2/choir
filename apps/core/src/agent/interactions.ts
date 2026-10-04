import type {
  CompleteElicitationNotification,
  CreateElicitationRequest,
  CreateElicitationResponse,
  ElicitationContentValue,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '@agentclientprotocol/sdk';

export type InteractionAnswer =
  | { optionId: string }
  | { action: 'accept'; content?: Record<string, ElicitationContentValue> }
  | { action: 'decline' }
  | { action: 'cancel' };

export type Interaction = { id: string } & (
  | { kind: 'permission'; request: RequestPermissionRequest }
  | { kind: 'elicitation'; request: CreateElicitationRequest }
);

export type InteractionEvent =
  | { type: 'requested'; interaction: Interaction }
  | { type: 'settled'; id: string; answer: InteractionAnswer }
  | { type: 'completed'; elicitationId: string };

export type InteractionReply = 'answered' | 'unknown' | 'unfit';

type Answer = (answer: InteractionAnswer) => boolean;

const CANCEL = { action: 'cancel' } as const;

function permissionResponse(
  { options }: RequestPermissionRequest,
  answer: InteractionAnswer,
): RequestPermissionResponse | undefined {
  if (!('optionId' in answer)) {
    if (answer.action !== 'cancel') return undefined;
    return { outcome: { outcome: 'cancelled' } };
  }
  const { optionId } = answer;
  if (!options.some((option) => option.optionId === optionId)) return undefined;
  return { outcome: { outcome: 'selected', optionId } };
}

function elicitationResponse(
  answer: InteractionAnswer,
): CreateElicitationResponse | undefined {
  return 'action' in answer ? answer : undefined;
}

export class Interactions {
  private readonly pending = new Map<string, Answer>();

  constructor(private readonly emit: (event: InteractionEvent) => void) {}

  permission(
    request: RequestPermissionRequest,
    signal: AbortSignal,
  ): Promise<RequestPermissionResponse> {
    return this.ask(
      (id) => ({ id, kind: 'permission', request }),
      signal,
      (answer) => permissionResponse(request, answer),
    );
  }

  elicitation(
    request: CreateElicitationRequest,
    signal: AbortSignal,
  ): Promise<CreateElicitationResponse> {
    return this.ask(
      (id) => ({ id, kind: 'elicitation', request }),
      signal,
      elicitationResponse,
    );
  }

  complete({ elicitationId }: CompleteElicitationNotification): void {
    this.emit({ type: 'completed', elicitationId });
  }

  respond(id: string, answer: InteractionAnswer): InteractionReply {
    const answered = this.pending.get(id);
    if (!answered) return 'unknown';
    return answered(answer) ? 'answered' : 'unfit';
  }

  cancelAll(): void {
    for (const answer of this.pending.values()) answer(CANCEL);
  }

  private ask<Response>(
    asked: (id: string) => Interaction,
    signal: AbortSignal,
    respond: (answer: InteractionAnswer) => Response | undefined,
  ): Promise<Response> {
    const id = crypto.randomUUID();
    const reply = Promise.withResolvers<Response>();
    const answer = (given: InteractionAnswer): boolean => {
      const response = respond(given);
      if (response === undefined) return false;
      this.pending.delete(id);
      this.emit({ type: 'settled', id, answer: given });
      reply.resolve(response);
      return true;
    };
    this.pending.set(id, answer);
    signal.addEventListener('abort', () => answer(CANCEL));
    this.emit({ type: 'requested', interaction: asked(id) });
    return reply.promise;
  }
}
