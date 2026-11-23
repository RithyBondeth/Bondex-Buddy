import { button, element, emptyState, type Announce } from './dom';
import { handoffsView } from './handoffs-view';
import { agentMascot } from './mascots';
import {
  agentNames,
  relativeTime,
  statusLabels,
  type AgentKind,
  type AgentSession,
  type AgentSnapshot,
  type AgentTokens,
} from './model';

const numbers = new Intl.NumberFormat();

function metric(label: string, value: string | number) {
  const row = element('div', 'agent-metric');
  row.append(
    element('dt', '', label),
    element(
      'dd',
      '',
      typeof value === 'number' ? numbers.format(value) : value,
    ),
  );
  return row;
}

function tokenMetrics(tokens: AgentTokens, label: string) {
  return [
    metric(label, tokens.total),
    ...(tokens.input === null ? [] : [metric('Input tokens', tokens.input)]),
    ...(tokens.output === null ? [] : [metric('Output tokens', tokens.output)]),
  ];
}

function tokenAvailability(agent: AgentKind, enabled: boolean) {
  if (agent === 'cursor' || agent === 'antigravity')
    return 'Token totals are unavailable from local hooks.';
  if ((agent === 'codex' || agent === 'claude') && !enabled)
    return 'Enable Codex and Claude token usage in menu bar Settings.';
  return 'Waiting for token counts from this agent.';
}

function clockTime(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function sessionCard(agent: AgentKind) {
  const item = element('article', 'agent-session');
  item.dataset.provider = agent;
  const top = element('div', 'agent-session-top');
  const avatar = element('div', 'agent-avatar');
  avatar.append(agentMascot(agent));
  const identity = element('div', 'session-identity');
  const name = element('span', 'session-agent', agentNames[agent]);
  const project = element('h3');
  identity.append(name, project);
  const status = element('span', 'status-pill');
  top.append(avatar, identity, status);

  const activity = element('p', 'session-activity');
  const footer = element('summary', 'session-metrics');
  const requests = element('span', 'session-requests');
  requests.title = 'Requests observed in this session';
  const elapsed = element('span', 'session-elapsed');
  footer.append(
    requests,
    elapsed,
    element('span', 'session-detail-label', 'Details'),
  );
  const details = element('details', 'session-details');
  const info = element('dl', 'agent-metrics');
  const tokenNote = element('p', 'agent-token-note');
  details.append(footer, info, tokenNote);
  item.append(top, activity, details);
  let detailKey = '';

  return {
    item,
    update(session: AgentSession, now: number, tokenUsageEnabled: boolean) {
      item.dataset.status = session.status;
      project.textContent = session.project;
      project.title = session.project;
      status.textContent = statusLabels[session.status];
      activity.textContent = session.activity;
      const { usage } = session;
      requests.textContent =
        agent === 'antigravity'
          ? `${usage.modelCalls} model call${usage.modelCalls === 1 ? '' : 's'}`
          : `${session.requests} request${session.requests === 1 ? '' : 's'}`;
      const sinceSignal = relativeTime(session.updatedAt, now).toLowerCase();
      elapsed.textContent =
        session.turnStartedAt === null
          ? `Signal ${sinceSignal}`
          : `${clockTime(now - session.turnStartedAt)} elapsed`;
      const key = JSON.stringify([
        session.model,
        usage,
        sinceSignal,
        tokenUsageEnabled,
      ]);
      if (detailKey !== key) {
        detailKey = key;
        info.replaceChildren(
          metric('Model', session.model ?? 'Waiting for model'),
          metric('Last signal', sinceSignal),
          metric('Tool calls', usage.toolCalls),
          ...(agent === 'cursor'
            ? [
                metric('Tool failures', usage.toolFailures),
                ...(usage.thinkingMs
                  ? [metric('Reported thinking', clockTime(usage.thinkingMs))]
                  : []),
              ]
            : []),
          ...(agent === 'gemini'
            ? [metric('Model calls', usage.modelCalls)]
            : []),
          ...(usage.tokens
            ? tokenMetrics(
                usage.tokens,
                usage.recentTokensOnly ? 'Recent tokens' : 'Session tokens',
              )
            : []),
        );
        tokenNote.hidden = usage.tokens !== null;
        tokenNote.textContent = tokenAvailability(agent, tokenUsageEnabled);
      }
    },
  };
}

function agentUsagePanel() {
  const panel = element('div', 'agent-usage-list');
  let key = '';
  return {
    panel,
    clear() {
      key = '';
      panel.replaceChildren(
        emptyState(
          'Agent usage is unavailable',
          'Buddy will check again in a moment.',
        ),
      );
    },
    render(snapshot: AgentSnapshot) {
      const next = JSON.stringify([
        snapshot.connections,
        snapshot.usage,
        snapshot.tokenUsageEnabled,
      ]);
      if (next === key) return;
      key = next;
      panel.replaceChildren(
        element(
          'p',
          'agent-token-note',
          'Counters cover sessions Buddy observed. Token totals refer to the last session that reported them.',
        ),
        ...snapshot.connections.map(({ agent, installed }) => {
          const card = element('article', 'provider-usage');
          card.dataset.provider = agent;
          const title = element('h3', 'provider-usage-name');
          title.append(
            agentMascot(agent),
            element('span', '', agentNames[agent]),
          );
          card.append(title);
          const usage = snapshot.usage.find((entry) => entry.agent === agent);
          if (!installed || !usage?.sessions) {
            card.append(
              element(
                'p',
                'agent-token-note',
                installed ? 'Waiting for a session.' : 'Not connected',
              ),
            );
            return card;
          }
          const info = element('dl', 'agent-metrics');
          info.append(
            metric('Observed sessions', usage.sessions),
            agent === 'antigravity'
              ? metric('Model calls', usage.modelCalls)
              : metric('Requests', usage.requests),
            metric('Tool calls', usage.toolCalls),
          );
          if (agent === 'gemini')
            info.append(metric('Model calls', usage.modelCalls));
          if (agent === 'cursor') {
            info.append(metric('Tool failures', usage.toolFailures));
            if (usage.thinkingMs)
              info.append(
                metric('Reported thinking', clockTime(usage.thinkingMs)),
              );
          }
          if (usage.latestTokens) {
            info.append(
              ...tokenMetrics(
                usage.latestTokens,
                usage.recentTokensOnly
                  ? 'Recent tokens'
                  : 'Latest session tokens',
              ),
            );
            if (usage.tokenSignalAt)
              info.append(
                metric(
                  'Last token report',
                  relativeTime(usage.tokenSignalAt).toLowerCase(),
                ),
              );
          }
          card.append(info);
          if (!usage.latestTokens)
            card.append(
              element(
                'p',
                'agent-token-note',
                tokenAvailability(agent, snapshot.tokenUsageEnabled),
              ),
            );
          return card;
        }),
      );
    },
  };
}

export function agentsView(
  announce: Announce,
  dismiss?: (item: AgentSession) => void,
) {
  const section = element('section', 'agents-view');
  section.id = 'agents-panel';
  section.setAttribute('role', 'tabpanel');
  section.setAttribute('aria-labelledby', 'agents-tab');
  const heading = element('div', 'agent-heading');
  const title = element('h2', '', 'Current work');
  const counts = element('span', 'agent-count', 'Checking…');
  const toggle = button('Usage', 'agent-usage-toggle');
  toggle.disabled = true;
  toggle.setAttribute('aria-pressed', 'false');
  heading.append(title, counts, toggle);
  const sessions = element('div', 'agent-sessions');
  const usage = agentUsagePanel();
  usage.panel.hidden = true;
  const handoffs = handoffsView(announce, dismiss);
  const handoffButton = button('Handoffs', 'handoff-indicator');
  handoffButton.hidden = true;
  const back = button('‹ Current work', 'agent-usage-toggle');
  back.hidden = true;
  heading.append(back);
  const connectedEmpty = emptyState(
    'No active projects',
    'Start a request in a connected agent to see it here.',
  );
  const disconnectedEmpty = emptyState(
    'Connect an agent',
    'Open Bondex Buddy in the menu bar, then Settings.',
  );
  const unavailable = emptyState(
    'Agent activity is unavailable',
    'Buddy will check again in a moment.',
  );
  section.append(heading, handoffButton, sessions, usage.panel, handoffs.panel);

  const cards = new Map<string, ReturnType<typeof sessionCard>>();
  let snapshot: AgentSnapshot | null | undefined;
  let mode: 'work' | 'usage' | 'handoffs' = 'work';
  function show(next: typeof mode) {
    mode = next;
    usage.panel.hidden = mode !== 'usage';
    handoffs.panel.hidden = mode !== 'handoffs';
    sessions.hidden = mode !== 'work';
    counts.hidden = mode !== 'work';
    toggle.hidden = mode === 'handoffs';
    back.hidden = mode !== 'handoffs';
    title.textContent =
      mode === 'usage'
        ? 'Agent usage'
        : mode === 'handoffs'
          ? 'Handoffs'
          : 'Current work';
    toggle.setAttribute('aria-pressed', String(mode === 'usage'));
    const items = snapshot?.handoffs ?? [];
    handoffButton.hidden = mode !== 'work' || items.length === 0;
    handoffButton.textContent = `Handoffs · ${items.length}`;
    if (mode === 'usage' && snapshot) usage.render(snapshot);
    if (mode === 'handoffs') handoffs.render(items);
  }

  toggle.addEventListener('click', () =>
    show(mode === 'usage' ? 'work' : 'usage'),
  );
  handoffButton.addEventListener('click', () => {
    show('handoffs');
    back.focus({ preventScroll: true });
  });
  back.addEventListener('click', () => {
    show('work');
    (handoffButton.hidden ? toggle : handoffButton).focus({
      preventScroll: true,
    });
  });

  function render(next: AgentSnapshot | null | undefined) {
    snapshot = next;
    show(mode);
    toggle.disabled = !next;
    if (next === undefined) return;
    if (next === null) {
      counts.textContent = 'Signal unavailable';
      counts.classList.remove('is-live');
      cards.clear();
      if (sessions.firstChild !== unavailable)
        sessions.replaceChildren(unavailable);
      usage.clear();
      return;
    }

    if (!usage.panel.hidden) usage.render(next);
    const now = Date.now();
    const working = next.sessions.filter(
      ({ status }) => status === 'working',
    ).length;
    const waiting = next.sessions.filter(
      ({ status }) => status === 'needsInput',
    ).length;
    counts.textContent =
      [working ? `${working} working` : '', waiting ? `${waiting} waiting` : '']
        .filter(Boolean)
        .join(' · ') || 'Idle';
    counts.classList.toggle('is-live', working + waiting > 0);
    const keys = new Set<string>();
    const items: HTMLElement[] = next.sessions.map((session) => {
      const key = `${session.agent}:${session.session}`;
      keys.add(key);
      let card = cards.get(key);
      if (!card) {
        card = sessionCard(session.agent);
        cards.set(key, card);
      }
      card.update(session, now, next.tokenUsageEnabled);
      return card.item;
    });
    for (const key of cards.keys()) {
      if (!keys.has(key)) cards.delete(key);
    }
    if (!items.length)
      items.push(
        next.connections.some(({ installed }) => installed)
          ? connectedEmpty
          : disconnectedEmpty,
      );
    if (
      sessions.childElementCount !== items.length ||
      items.some((item, index) => sessions.children[index] !== item)
    ) {
      sessions.replaceChildren(...items);
    }
  }

  return {
    section,
    render,
    showHandoffs() {
      show('handoffs');
      back.focus({ preventScroll: true });
    },
  };
}
