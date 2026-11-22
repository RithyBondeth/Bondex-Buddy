import { element, emptyState } from './dom';
import { agentMascot } from './mascots';
import {
  agentNames,
  relativeTime,
  statusLabels,
  type AgentSession,
  type AgentSnapshot,
} from './model';

function sessionCard(agent: AgentSession['agent']) {
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
  const footer = element('div', 'session-metrics');
  const requests = element('span', 'session-requests');
  requests.title = 'Requests observed by Ember in this session';
  const elapsed = element('span', 'session-elapsed');
  elapsed.title = 'Elapsed time for the last observed turn, including any wait';
  const signal = element('time', 'session-time');
  footer.append(requests, elapsed, signal);
  item.append(top, activity, footer);

  return {
    item,
    update(session: AgentSession, now: number) {
      item.dataset.status = session.status;
      name.title = session.model ? `Last reported model: ${session.model}` : '';
      project.textContent = session.project;
      project.title = session.project;
      status.textContent = statusLabels[session.status];
      activity.textContent = session.activity;
      requests.textContent = `${session.requests} request${session.requests === 1 ? '' : 's'}`;
      elapsed.hidden =
        session.turnStartedAt === null || session.status === 'stale';
      if (!elapsed.hidden && session.turnStartedAt !== null) {
        const end =
          session.status === 'working' || session.status === 'needsInput'
            ? now
            : session.updatedAt;
        const seconds = Math.max(
          0,
          Math.floor((end - session.turnStartedAt) / 1000),
        );
        elapsed.textContent =
          seconds < 60
            ? `${seconds}s elapsed`
            : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
      }
      signal.dateTime = new Date(session.updatedAt).toISOString();
      const updated = `Signal ${relativeTime(session.updatedAt, now).toLowerCase()}`;
      signal.textContent = elapsed.hidden ? updated : '';
      signal.hidden = !elapsed.hidden;
      activity.title = updated;
    },
  };
}

export function agentsView() {
  const section = element('section', 'agents-view');
  section.id = 'agents-panel';
  section.setAttribute('role', 'tabpanel');
  section.setAttribute('aria-labelledby', 'agents-tab');
  const heading = element('div', 'agent-heading');
  const counts = element('span', 'agent-count', 'Checking…');
  heading.append(element('h2', '', 'Agent activity'), counts);
  const sessions = element('div', 'agent-sessions');
  const connectedEmpty = emptyState(
    'Waiting for a signal',
    'Start a request in a connected agent to see it here.',
  );
  const disconnectedEmpty = emptyState(
    'Connect an agent',
    'Open Bondex Buddy in the menu bar, then Settings.',
  );
  const unavailable = emptyState(
    'Agent activity is unavailable',
    'Ember will check again in a moment.',
  );
  section.append(heading, sessions);

  const cards = new Map<string, ReturnType<typeof sessionCard>>();

  function render(snapshot: AgentSnapshot | null | undefined) {
    if (snapshot === undefined) return;
    if (snapshot === null) {
      counts.textContent = 'Signal unavailable';
      counts.classList.remove('is-live');
      cards.clear();
      if (sessions.firstChild !== unavailable)
        sessions.replaceChildren(unavailable);
      return;
    }
    const now = Date.now();
    const working = snapshot.sessions.filter(
      ({ status }) => status === 'working',
    ).length;
    const waiting = snapshot.sessions.filter(
      ({ status }) => status === 'needsInput',
    ).length;
    counts.textContent =
      [working ? `${working} working` : '', waiting ? `${waiting} waiting` : '']
        .filter(Boolean)
        .join(' · ') || 'No active work';
    counts.classList.toggle('is-live', working + waiting > 0);
    const nextKeys = new Set<string>();
    const items: HTMLElement[] = snapshot.sessions.map((session) => {
      const key = `${session.agent}:${session.session}`;
      nextKeys.add(key);
      let card = cards.get(key);
      if (!card) {
        card = sessionCard(session.agent);
        cards.set(key, card);
      }
      card.update(session, now);
      return card.item;
    });
    for (const key of cards.keys()) {
      if (!nextKeys.has(key)) cards.delete(key);
    }
    if (!items.length)
      items.push(
        snapshot.connections.some(({ installed }) => installed)
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

  return { section, render };
}
