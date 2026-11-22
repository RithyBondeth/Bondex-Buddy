import { element } from './dom';
import { agentMascot } from './mascots';
import {
  agentNames,
  statusLabels,
  type AgentSession,
  type AgentSnapshot,
} from './model';

export function createPetAgentThought() {
  const label = element('div', 'pet-agent');
  label.setAttribute('aria-hidden', 'true');
  const copy = element('div', 'pet-agent-copy');
  const identity = element('strong');
  const project = element('span');
  copy.append(identity, project);
  label.append(copy);

  const pair = element('div', 'pet-agent-pair');
  pair.setAttribute('aria-hidden', 'true');
  const portraits = element('div', 'pet-agent-portraits');
  const details = element('div', 'pet-agent-details');
  pair.append(portraits, details);
  pair.hidden = true;
  let portraitKey = '';
  let detailsKey = '';

  function update(snapshot: AgentSnapshot | null) {
    const cue = snapshot?.cue;
    const working =
      snapshot?.sessions.filter(({ status }) => status === 'working') ?? [];
    if (cue) {
      if (label.dataset.provider !== cue.agent) {
        label.querySelector('img')?.remove();
        label.prepend(agentMascot(cue.agent));
        label.dataset.provider = cue.agent;
      }
      identity.textContent = agentStatus(cue);
      project.textContent = cue.project;
    }
    const showPair = working.length >= 2;
    label.hidden = showPair;
    pair.hidden = !showPair;
    if (!showPair) return cue ? `${agentStatus(cue)} in ${cue.project}` : '';

    // Keep the two portraits in place when one session reports a new tool event.
    const featured = working
      .sort(
        (a, b) =>
          a.agent.localeCompare(b.agent) || a.session.localeCompare(b.session),
      )
      .slice(0, 2);
    const nextPortraits = featured.map(({ agent }) => agent).join(':');
    if (portraitKey !== nextPortraits) {
      portraits.replaceChildren(
        ...featured.map(({ agent }) => agentMascot(agent)),
      );
      portraitKey = nextPortraits;
    }
    const nextDetails = JSON.stringify([
      working.length,
      featured.map(({ agent, project, activity }) => [
        agent,
        project,
        activity,
      ]),
    ]);
    if (detailsKey !== nextDetails) {
      const rows = featured.map((session) => {
        const row = element('div', 'pet-agent-detail');
        row.dataset.provider = session.agent;
        row.append(
          element(
            'strong',
            '',
            `${agentNames[session.agent]} · ${session.project}`,
          ),
          element('span', '', session.activity),
        );
        return row;
      });
      if (working.length > featured.length)
        rows.push(
          element(
            'div',
            'pet-agent-more',
            `+${working.length - featured.length} working`,
          ),
        );
      details.replaceChildren(...rows);
      detailsKey = nextDetails;
    }
    return `${working.length} agents working. ${featured.map((session) => `${agentNames[session.agent]} in ${session.project}`).join(', ')}`;
  }

  return { label, pair, update };
}

function agentStatus(session: AgentSession): string {
  return `${agentNames[session.agent]} · ${statusLabels[session.status]}`;
}
