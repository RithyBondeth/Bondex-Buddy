# Ember’s desktop tools

Click Ember to open a compact thought bubble with **Focus**, **Clipboard**, and **Agents**. Right-click Ember, press **U** while it has keyboard focus, or use a menu bar shortcut to open it directly to a tool. **Escape**, the close button, or clicking Ember collapses the bubble while preserving the timer and search.

On macOS, click the Bondex Buddy menu bar icon and choose **Settings…**. Settings holds decor, outfits, lighting, sound, Ghost Mode, playful roaming, launch at login, clipboard capture, and agent connections. On Windows, open Settings from the tray menu. Launch at login is available in release builds.

The native window grows from 220 × 200 to at most 264 × 256 logical pixels within the display’s work area. The extra area appears above and to the left of the pet. Drag Ember or the shelf to move it. Arrow keys also move the pet when it has focus. Closing the bubble keeps the latest position. Roaming pauses while the bubble is open and retains its enabled preference. The rounded bubble and pet silhouette receive clicks. The decorative dots and surrounding transparent areas pass clicks through. Longer lists scroll inside the bubble.

## Clipboard

Capture is off until **Clipboard capture** is turned on in Settings. The native observer samples plain text every 900 ms, including while the panel is hidden. Starting or resuming capture establishes a baseline and excludes the text already on the clipboard. Images and other non-text formats are skipped. Text exceeding 16,384 UTF-8 bytes is skipped.

The history holds up to 50 unique clips, with up to 20 pins. Repeated text updates its recency; pinned snippets sort first. Search and the Pinned filter can be combined. Copy writes an existing clip to the system clipboard; it does not simulate a paste or change the foreground application. Removing or clearing entries does not cause an unchanged clipboard to be captured again. Clear all includes pins and requires a second click within four seconds.

Recent history stays in process memory and clears when the app quits. Only the capture preference and explicitly pinned snippets are saved in `clipboard.json` under Tauri’s app-data directory. Pinned text is stored as local JSON, not encrypted. Pausing stops observation and leaves existing clips available. Clipboard text is never sent to an agent or network service. Capture includes copied plain text from all apps, so pause it before copying anything you do not want in history. Password detection and per-app exclusions are not implemented.

Clipboard mutations are serialized. Persistent edits save before updating in-memory state, and invalid or unsupported files are preserved with capture disabled. Atomic writes use a same-directory temporary file with owner-only permissions on Unix. The frontend can copy only an existing clip ID; it has no broad clipboard-plugin permission. Ember’s window reads clipboard history and edits existing clips. Only the Settings window can change clipboard capture and agent connections.

## Codex and Claude Code

Both integrations use the agents’ lifecycle command hooks. **Connect** appends Buddy’s entries while preserving other settings and existing hooks, including Bondex Notch hooks. It first saves an owner-only backup beside the settings file and rejects malformed JSON or unsupported hook shapes. It also detects a settings edit between its read and write. **Disconnect** removes Buddy’s entries. Neither action changes approval policies or trusts hooks on the user’s behalf.

Configuration locations:

| Agent       | Settings                                                                | Events                                                                                                                  |
| ----------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Codex       | `$CODEX_HOME/hooks.json`, otherwise `~/.codex/hooks.json`               | SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PermissionRequest, Stop, SessionEnd, Interrupt                 |
| Claude Code | `$CLAUDE_CONFIG_DIR/settings.json`, otherwise `~/.claude/settings.json` | SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PermissionRequest, Notification, Stop, StopFailure, SessionEnd |

After connecting, restart the agent. Codex requires review of the new hook definitions in `/hooks` or **Settings → Hooks**. A configuration marked “Hooks installed” does not establish that the agent has trusted it or sent an event. If hooks have been disabled by agent settings or managed policy, enable them in that agent before expecting signals. Start a new request to verify that a session appears. Moving the Buddy executable requires reconnecting it so the hook path is updated. Windows Codex hooks assume its default PowerShell environment; Claude Code selects PowerShell explicitly on Windows. Alternate Windows shells need separate acceptance.

The app’s `--buddy-agent-hook codex|claude` entry point runs before Tauri or single-instance startup. It consumes bounded JSON from stdin, writes a small status file, emits no output or decisions, and exits successfully even when an event cannot be recorded. It never launches the pet window. Hook timeout is two seconds. Claude hooks explicitly continue on failure.

Status is recorded per agent and session with a project basename, short activity label, latest signal time, last reported model identifier when present, observed request count, and the start time of the latest observed turn. Prompts, transcripts, tool arguments, output, and full working-directory paths are discarded. The Agents tab shows locally observed requests and turn elapsed time, including any time spent waiting for input. Working and waiting sessions become **Signal quiet** after 15 minutes without an event. Up to 40 sessions appear in the thought, with active work ahead of history. Records expire after 24 hours. Disconnecting an integration removes it from the thought and Ember’s cues.

Ember uses a working pose while an agent is active, rests roaming while it is working or needs input, and shows a small thought with the agent’s mascot, status, and project. When two agents are working, Ember shows their mascots side by side and reveals their projects and activity on hover or keyboard focus. Clicking Ember during active work or an attention request opens the Agents tab in the same thought as Focus and Clipboard. Ember performs a brief Happy reaction on completion outside a running focus session.

The browser preview at `/buddy.html` uses optional sample clips and cannot collect system history or install agent hooks. Native permissions and integration behavior must be checked in the desktop app.

Implementation follows the [Tauri clipboard API](https://v2.tauri.app/plugin/clipboard/), [Codex hook configuration and trust](https://learn.chatgpt.com/docs/hooks), and [Claude Code hook reference](https://code.claude.com/docs/en/hooks). Installed Codex 0.169.0-alpha.11.1 and Claude Code 2.1.318 were inspected during development. Windows native acceptance remains separate from a successful macOS build.
