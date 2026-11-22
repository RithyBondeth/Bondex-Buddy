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
  label.hidden = true;
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
    const handoff = snapshot?.handoffs?.[0];
    const cue = handoff ?? snapshot?.cue;
    const working =
      snapshot?.sessions.filter(({ status }) => status === 'working') ?? [];
    const current =
      cue?.status === 'working' ||
      cue?.status === 'needsInput' ||
      (cue?.status === 'done' && !!handoff);
    if (current) {
      if (label.dataset.provider !== cue.agent) {
        label.querySelector('img')?.remove();
        label.prepend(agentMascot(cue.agent));
        label.dataset.provider = cue.agent;
      }
      identity.textContent = agentStatus(cue);
      project.textContent = cue.project;
      label.dataset.status = cue.status;
    }
    const showPair = working.length >= 2;
    label.hidden = showPair || !current;
    pair.hidden = !showPair;
    if (!showPair)
      return current
        ? `${agentStatus(cue)} in ${cue.project}`
        : cue?.status === 'error'
          ? agentStatus(cue)
          : '';

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
    const announcement = `${working.length} agents working. ${featured.map((session) => `${agentNames[session.agent]} in ${session.project}`).join(', ')}`;
    return handoff
      ? `${agentStatus(handoff)} in ${handoff.project}. ${announcement}`
      : announcement;
  }

  return { label, pair, update };
}

function agentStatus(session: AgentSession): string {
  return `${agentNames[session.agent]} · ${statusLabels[session.status]}`;
}
