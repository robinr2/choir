export type AgentLink = {
  conversationId: string;
  sessionId: string | null;
  cwd: string;
  model: string | null;
  effort: string | null;
  mode: string | null;
};

export type SessionSettings = {
  model?: string;
  effort?: string;
  mode?: string;
};

export type NewSessionLaunch = SessionSettings & { cwd: string };

type ResumeLaunch = { resume: string; cwd: string; fork?: boolean };

export type Launch = NewSessionLaunch | ResumeLaunch;

export function newSessionLink(
  conversationId: string,
  { cwd, model, effort, mode }: NewSessionLaunch,
): AgentLink {
  return {
    conversationId,
    sessionId: null,
    cwd,
    model: model ?? null,
    effort: effort ?? null,
    mode: mode ?? null,
  };
}

export function sessionLink(
  conversationId: string,
  sessionId: string,
  cwd: string,
): AgentLink {
  return { ...newSessionLink(conversationId, { cwd }), sessionId };
}

export function sessionSettings({
  model,
  effort,
  mode,
}: AgentLink): SessionSettings {
  return {
    ...(model !== null && { model }),
    ...(effort !== null && { effort }),
    ...(mode !== null && { mode }),
  };
}
