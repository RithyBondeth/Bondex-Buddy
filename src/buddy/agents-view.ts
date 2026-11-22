import { readAgents } from './api';
import { element, emptyState } from './dom';
import {
  agentNames,
  relativeTime,
  statusLabels,
  type AgentSnapshot,
} from './model';

export function agentsView() {
  const section = element('section', 'agents-view');
  section.id = 'agents-panel';
  section.setAttribute('role', 'tabpanel');
  section.setAttribute('aria-labelledby', 'agents-tab');
  section.append(element('h2', '', 'AI agents'));
  const heading = element('div', 'list-meta');
  const count = element('span', '', 'Loading agent status…');
  heading.append(count);
  const sessions = element('div', 'agent-sessions');
  const privacy = element(
    'p',
    'privacy-note',
    'Project name and activity only. No prompts, transcripts, or tool contents. Quiet signals become “Signal quiet” after 15 minutes.',
  );
  section.append(heading, sessions, privacy);
  let key = '';
  function render(snapshot: AgentSnapshot) {
    const next = JSON.stringify(snapshot);
    if (next === key) return;
    key = next;
    count.textContent = `LOCAL SESSIONS · ${snapshot.sessions.length}`;
    sessions.replaceChildren(
      ...(snapshot.sessions.length
        ? snapshot.sessions.map((session) => {
            const item = element('article', 'agent-session');
            item.dataset.status = session.status;
            const top = element('div', 'agent-session-top');
            const identity = element(
              'span',
              'session-agent',
              agentNames[session.agent],
            );
            const status = element(
              'span',
              'status-pill',
              statusLabels[session.status],
            );
            top.append(identity, status);
            const title = element('h3', '', session.project);
            const activity = element('p', 'session-activity', session.activity);
            const time = element(
              'time',
              'session-time',
              `Updated ${relativeTime(session.updatedAt).toLowerCase()}`,
            );
            time.dateTime = new Date(session.updatedAt).toISOString();
            item.append(top, title, activity, time);
            return item;
          })
        : [
            emptyState(
              'Ember’s keeping an ear out.',
              snapshot.connections.some((c) => c.installed)
                ? 'Start a new request in your connected agent. Its status will appear here.'
                : 'Connect an agent in menu bar Settings.',
            ),
          ]),
    );
  }

  return {
    section,
    async refresh() {
      render(await readAgents());
    },
  };
}
