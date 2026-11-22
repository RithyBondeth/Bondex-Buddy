import claude from './mascots/claude.png';
import codex from './mascots/codex.png';
import { element } from './dom';
import type { AgentKind } from './model';

const portraits = { claude, codex };

export function agentMascot(agent: AgentKind) {
  const sprite = element('img', 'agent-mascot');
  sprite.src = portraits[agent];
  sprite.alt = '';
  sprite.draggable = false;
  return sprite;
}
