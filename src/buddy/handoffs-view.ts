import { handoffAgent } from './api';
import { button, element, errorMessage, type Announce } from './dom';
import { agentMascot } from './mascots';
import { agentNames, statusLabels, type AgentSession } from './model';

export function handoffsView(
  announce: Announce,
  dismiss?: (item: AgentSession) => void,
) {
  const panel = element('div', 'agent-handoffs');
  panel.hidden = true;
  const empty = element('p', 'agent-token-note', 'No handoffs right now.');
  let key = '';

  function card(item: AgentSession) {
    const row = element('article', 'provider-usage handoff-card');
    row.dataset.provider = item.agent;
    const title = element('h3', 'provider-usage-name');
    title.append(
      agentMascot(item.agent),
      element('span', '', agentNames[item.agent]),
    );
    const project = element('p', 'handoff-project', item.project);
    const status = element('p', 'handoff-status', statusLabels[item.status]);
    const actions = element('div', 'handoff-actions');
    const shortcut = button(
      item.agent === 'codex'
        ? 'Open Codex'
        : item.agent === 'cursor'
          ? 'Copy ID'
          : 'Copy command',
      'agent-usage-toggle',
    );
    shortcut.title =
      item.agent === 'cursor'
        ? 'Copy this conversation’s ID'
        : 'Shortcut to this session';
    shortcut.addEventListener('click', async () => {
      shortcut.disabled = true;
      try {
        announce(await handoffAgent(item));
      } catch (error) {
        announce(errorMessage(error), true);
      } finally {
        shortcut.disabled = false;
      }
    });
    actions.append(shortcut);
    if (item.status === 'done' && dismiss) {
      const clear = button('Dismiss', 'text-button');
      clear.setAttribute(
        'aria-label',
        `Dismiss ${agentNames[item.agent]} handoff for ${item.project}`,
      );
      clear.addEventListener('click', () => dismiss(item));
      actions.append(clear);
    }
    row.append(title, project, status, actions);
    return row;
  }

  return {
    panel,
    render(items: AgentSession[]) {
      const next = JSON.stringify(
        items.map(({ agent, session, project, status }) => [
          agent,
          session,
          project,
          status,
        ]),
      );
      if (key === next) return;
      key = next;
      panel.replaceChildren(...(items.length ? items.map(card) : [empty]));
    },
  };
}
