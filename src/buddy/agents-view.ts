import { connectAgent, native, readAgents } from './api';
import {
  button,
  element,
  emptyState,
  errorMessage,
  type Announce,
} from './dom';
import {
  agentNames,
  relativeTime,
  statusLabels,
  type AgentSnapshot,
} from './model';

export function agentsView(announce: Announce) {
  const section = element('section', 'agents-view');
  section.id = 'agents-panel';
  section.setAttribute('role', 'tabpanel');
  section.setAttribute('aria-labelledby', 'agents-tab');
  section.append(element('h2', '', 'Your little team.'));
  const description = element(
    'p',
    'section-description',
    'Connect Codex and Claude Code to see when they’re working, ready, or waiting for you.',
  );
  const connections = element('div', 'agent-connections');
  const note = element(
    'p',
    'connection-note',
    'Connect adds a status hook and keeps a settings backup. Existing hooks stay in place. Restart the agent afterward. In Codex, review the new hooks in /hooks or Settings → Hooks before they can run.',
  );
  const heading = element('div', 'list-meta');
  const count = element('span', '', 'Loading agent status…');
  heading.append(count);
  const sessions = element('div', 'agent-sessions');
  const privacy = element(
    'p',
    'privacy-note',
    'Project name and activity only. No prompts, transcripts, or tool contents. Quiet signals become “Signal quiet” after 15 minutes.',
  );
  section.append(description, connections, note, heading, sessions, privacy);
  let key = '';
  let busy = false;
  let operationVersion = 0;

  function render(snapshot: AgentSnapshot) {
    const next = JSON.stringify(snapshot);
    if (next === key) return;
    key = next;
    const focus = connections.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.agent
      : undefined;
    connections.replaceChildren(
      ...snapshot.connections.map((connection) => {
        const item = element('div', 'agent-connection');
        const identity = element('div', 'agent-identity');
        const mark = element(
          'span',
          `agent-mark ${connection.agent}`,
          connection.agent === 'codex' ? 'C_' : '✳',
        );
        mark.setAttribute('aria-hidden', 'true');
        const details = element('div');
        details.append(
          element('h3', '', agentNames[connection.agent]),
          element(
            'p',
            '',
            connection.error
              ? 'Setup needs attention'
              : connection.installed
                ? 'Hooks installed'
                : 'Not connected',
          ),
        );
        identity.append(mark, details);
        const connect = button(
          connection.installed ? 'Disconnect' : 'Connect',
          connection.installed ? 'quiet-button' : 'connect-button',
        );
        connect.dataset.agent = connection.agent;
        connect.disabled = !native || busy;
        connect.setAttribute(
          'aria-label',
          `${connection.installed ? 'Disconnect' : 'Connect'} ${agentNames[connection.agent]}`,
        );
        if (!native) connect.title = 'Available in the desktop app';
        connect.addEventListener('click', () => {
          if (busy) return;
          busy = true;
          operationVersion++;
          for (const control of connections.querySelectorAll('button'))
            control.disabled = true;
          void connectAgent(connection.agent, !connection.installed)
            .then(() =>
              announce(
                connection.installed
                  ? `${agentNames[connection.agent]} disconnected. Restart it to finish removing the hook.`
                  : `${agentNames[connection.agent]} connected. Restart it, then approve the new hook if asked.`,
              ),
            )
            .catch((error: unknown) => announce(errorMessage(error), true))
            .finally(() => {
              busy = false;
              key = '';
              void refresh().catch((error: unknown) =>
                announce(errorMessage(error), true),
              );
            });
        });
        item.append(identity, connect);
        if (connection.error)
          item.append(
            element('p', 'inline-error connection-error', connection.error),
          );
        return item;
      }),
    );
    if (focus)
      connections
        .querySelector<HTMLButtonElement>(`[data-agent="${focus}"]`)
        ?.focus();
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
                : 'Connect an agent above to bring its activity here.',
            ),
          ]),
    );
  }

  async function refresh() {
    if (busy) return;
    const version = operationVersion;
    const snapshot = await readAgents();
    if (!busy && version === operationVersion) render(snapshot);
  }

  return {
    section,
    refresh,
    focus: () =>
      connections.querySelector<HTMLButtonElement>('button')?.focus(),
  };
}
