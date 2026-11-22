import antigravity from './mascots/antigravity.png';
import claude from './mascots/claude.png';
import codex from './mascots/codex.png';
import cursor from './mascots/cursor.png';
import gemini from './mascots/gemini.png';
import { element } from './dom';
import type { AgentKind } from './model';

const portraits = { antigravity, claude, codex, cursor, gemini };

export function agentMascot(agent: AgentKind) {
  const sprite = element('img', 'agent-mascot');
  sprite.src = portraits[agent];
  sprite.alt = '';
  sprite.draggable = false;
  return sprite;
}
