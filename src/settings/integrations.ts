import { invoke, isTauri } from '@tauri-apps/api/core';
import { connectAgent } from '../buddy/api';
import { button, element, errorMessage, type Announce } from '../buddy/dom';
import {
  agentNames,
  disconnectedAgents,
  type AgentSnapshot,
} from '../buddy/model';
import { settingRow, settingSwitch, settingsGroup } from './habitat';

type CaptureStatus = { enabled: boolean; error: string | null };

export function integrationSettings(announce: Announce) {
  const native = isTauri();
  const section = element('div', 'settings-pane');
  const clipboard = settingsGroup('Clipboard');
  const capture = settingSwitch();
  const captureError = element('p', 'inline-error');
  captureError.hidden = true;
  clipboard.append(
    settingRow(
      'Clipboard capture',
      capture,
      'Collects new text you copy. Only pinned clips stay after you quit.',
    ),
    captureError,
  );

  const agents = settingsGroup('AI agents');
  const connections = element('div', 'agent-connections');
  const guidance = element(
    'p',
    'settings-note',
    'Connect adds local activity hooks and saves a backup. Restart the agent afterward. In Codex, review the hooks in Settings → Hooks.',
  );
  const tokenUsage = settingSwitch();
  tokenUsage.disabled = true;
  agents.append(
    connections,
    guidance,
    settingRow(
      'Codex and Claude token usage',
      tokenUsage,
      'Read token counters from connected sessions’ local logs. Bondex Buddy saves only the usage numbers.',
    ),
  );
  section.append(clipboard, agents);
  let clipboardBusy = false;
  let agentBusy = false;
  let tokenUsageBusy = false;

  function renderCapture(state: CaptureStatus) {
    capture.checked = state.enabled;
    capture.disabled = !native;
    captureError.textContent = state.error;
    captureError.hidden = !state.error;
  }

  function renderConnections(items: AgentSnapshot['connections']) {
    const focused = document.activeElement as HTMLElement | null;
    const activeAgent = connections.contains(focused)
      ? focused?.dataset.agent
      : undefined;
    connections.replaceChildren(
      ...items.map((entry) => {
        const row = element('div', 'agent-connection');
        const detail = element('div', 'setting-description');
        detail.append(
          element('span', '', agentNames[entry.agent]),
          element(
            'small',
            '',
            entry.error
              ? 'Setup needs attention'
              : entry.installed
                ? 'Hooks installed'
                : 'Not connected',
          ),
        );
        const control = button(
          entry.installed ? 'Disconnect' : 'Connect',
          'connect-button',
        );
        control.dataset.agent = entry.agent;
        control.disabled = !native || agentBusy;
        control.setAttribute(
          'aria-label',
          `${entry.installed ? 'Disconnect' : 'Connect'} ${agentNames[entry.agent]}`,
        );
        control.addEventListener('click', async () => {
          if (agentBusy) return;
          agentBusy = true;
          connections
            .querySelectorAll('button')
            .forEach((item) => (item.disabled = true));
          try {
            await connectAgent(entry.agent, !entry.installed);
            announce(
              `${agentNames[entry.agent]} ${entry.installed ? 'disconnected' : 'connected'}. Restart it to apply the change.`,
            );
          } catch (error) {
            announce(errorMessage(error), true);
          } finally {
            agentBusy = false;
            try {
              await refreshAgents();
              connections
                .querySelector<HTMLButtonElement>(
                  `[data-agent="${entry.agent}"]`,
                )
                ?.focus();
            } catch (error) {
              renderConnections(items);
              announce(errorMessage(error), true);
            }
          }
        });
        row.append(detail, control);
        if (entry.error)
          row.append(
            element('p', 'inline-error connection-error', entry.error),
          );
        return row;
      }),
    );
    if (activeAgent)
      connections
        .querySelector<HTMLButtonElement>(`[data-agent="${activeAgent}"]`)
        ?.focus();
  }

  async function refreshClipboard() {
    if (!native || clipboardBusy) return;
    const state = await invoke<CaptureStatus>('clipboard_capture_status');
    if (!clipboardBusy) renderCapture(state);
  }

  async function refreshAgents() {
    if (!native || agentBusy) return;
    const items =
      await invoke<AgentSnapshot['connections']>('agent_connections');
    if (!agentBusy) renderConnections(items);
  }

  async function refreshTokenUsage() {
    if (!native || tokenUsageBusy) return;
    const enabled = await invoke<boolean>('agent_token_usage');
    if (!tokenUsageBusy) {
      tokenUsage.checked = enabled;
      tokenUsage.disabled = false;
    }
  }

  tokenUsage.addEventListener('change', async () => {
    const enabled = tokenUsage.checked;
    tokenUsageBusy = true;
    tokenUsage.disabled = true;
    try {
      tokenUsage.checked = await invoke<boolean>('set_agent_token_usage', {
        enabled,
      });
    } catch (error) {
      tokenUsage.checked = !enabled;
      announce(errorMessage(error), true);
    } finally {
      tokenUsageBusy = false;
      tokenUsage.disabled = false;
    }
  });

  capture.addEventListener('change', async () => {
    const enabled = capture.checked;
    clipboardBusy = true;
    capture.disabled = true;
    try {
      renderCapture(
        await invoke<CaptureStatus>('set_clipboard_capture', { enabled }),
      );
    } catch (error) {
      capture.checked = !enabled;
      capture.disabled = false;
      announce(errorMessage(error), true);
    } finally {
      clipboardBusy = false;
    }
  });

  if (!native) renderConnections(disconnectedAgents);

  return {
    section,
    async refresh() {
      await Promise.all([
        refreshClipboard(),
        refreshAgents(),
        refreshTokenUsage(),
      ]);
    },
  };
}
