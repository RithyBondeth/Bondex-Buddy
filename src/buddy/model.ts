export interface Clip {
  id: number;
  text: string;
  pinned: boolean;
  copiedAt: number;
}

export interface ClipboardSnapshot {
  enabled: boolean;
  entries: Clip[];
  error: string | null;
  revision: number;
}

export const agentNames = {
  codex: 'Codex',
  claude: 'Claude Code',
  gemini: 'Gemini CLI',
  antigravity: 'Antigravity',
  cursor: 'Cursor',
};

export type AgentKind = keyof typeof agentNames;
export type AgentStatus =
  'working' | 'needsInput' | 'done' | 'idle' | 'error' | 'stale';

export interface AgentTokens {
  input: number | null;
  output: number | null;
  total: number;
}

interface AgentActivity {
  toolCalls: number;
  toolFailures: number;
  modelCalls: number;
  thinkingMs: number;
  recentTokensOnly: boolean;
}

export interface AgentUsage extends AgentActivity {
  agent: AgentKind;
  sessions: number;
  requests: number;
  latestTokens: AgentTokens | null;
  tokenSignalAt: number | null;
}

export interface AgentSession {
  agent: AgentKind;
  session: string;
  project: string;
  status: AgentStatus;
  activity: string;
  updatedAt: number;
  requests: number;
  turnStartedAt: number | null;
  model: string | null;
  usage: AgentActivity & { tokens: AgentTokens | null };
}

export interface AgentSnapshot {
  connections: {
    agent: AgentKind;
    installed: boolean;
    error: string | null;
  }[];
  sessions: AgentSession[];
  cue: AgentSession | null;
  usage: AgentUsage[];
  tokenUsageEnabled: boolean;
}

export const disconnectedAgents = (Object.keys(agentNames) as AgentKind[]).map(
  (agent) => ({ agent, installed: false, error: null }),
);

export const statusLabels: Record<AgentStatus, string> = {
  working: 'Working',
  needsInput: 'Needs you',
  done: 'Response ready',
  idle: 'Idle',
  error: 'Error',
  stale: 'Signal quiet',
};

export function selectClips(
  entries: Clip[],
  query: string,
  onlyPinned: boolean,
): Clip[] {
  const term = query.trim().toLocaleLowerCase();
  return entries
    .filter(
      (entry) =>
        (!onlyPinned || entry.pinned) &&
        entry.text.toLocaleLowerCase().includes(term),
    )
    .sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.copiedAt - a.copiedAt,
    );
}

export function relativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
