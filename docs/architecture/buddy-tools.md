# Ember’s desktop tools

Ember’s tools live in an animated speech-bubble pocket attached directly to the pet. Click Ember or **Tools** to open it. The **Focus**, **Clipboard**, **Agents**, and **Style** tabs expose the timer, clips, both agent integrations, wardrobe, lighting, Ghost Mode, and roaming; sound stays available in the pocket footer. Right-clicking Ember, pressing **U** while it has keyboard focus, and tray shortcuts open the same pocket directly to a tool. **Escape**, the close button, or clicking Ember collapses it without losing the timer or search.

The same native window expands from 220 × 200 to at most 400 × 600 logical pixels, constrained to the current display’s work area. Its position offsets the extra area above and to the left of the pet. Collapse restores the prior position and manual-placement preference. Roaming pauses while the pocket is open and retains its enabled preference. The native hit region covers the sheet, speech-bubble tail, Tools button, and the offset pet silhouette; surrounding transparent space passes clicks through. The pocket uses transform/opacity entry and exit, short tab transitions, and a static presentation under reduced motion. No second tools window is created.

## Clipboard

Capture is off until **Enable capture** is selected. The native observer samples plain text every 900 ms, including while the panel is hidden. Starting or resuming capture establishes a baseline and excludes the text already on the clipboard. Images and other non-text formats are skipped. Text exceeding 16,384 UTF-8 bytes is skipped.

The history holds up to 50 unique clips, with up to 20 pins. Repeated text updates its recency; pinned snippets sort first. Search and the Pinned filter can be combined. Copy writes an existing clip to the system clipboard; it does not simulate a paste or change the foreground application. Removing or clearing entries does not cause an unchanged clipboard to be captured again. Clear all includes pins and requires a second click within four seconds.

Recent history stays in process memory and clears when the app quits. Only the capture preference and explicitly pinned snippets are saved in `clipboard.json` under Tauri’s app-data directory. Pinned text is stored as local JSON, not encrypted. Pausing stops observation and leaves existing clips available. Clipboard text is never sent to an agent or network service. Capture includes copied plain text from all apps, so pause it before copying anything you do not want in history. Password detection and per-app exclusions are not implemented.

Clipboard mutations are serialized. Persistent edits save before updating in-memory state, and invalid or unsupported files are preserved with capture disabled. Atomic writes use a same-directory temporary file with owner-only permissions on Unix. The frontend can copy only an existing clip ID; it has no broad clipboard-plugin permission. Clipboard snapshots, edits, and agent setup accept calls only from Ember’s main window.

## Codex and Claude Code

Both integrations use the agents’ lifecycle command hooks. **Connect** appends Buddy’s entries while preserving other settings and existing hooks, including Bondex Notch hooks. It first saves an owner-only backup beside the settings file and rejects malformed JSON or unsupported hook shapes. It also detects a settings edit between its read and write. **Disconnect** removes Buddy’s entries. Neither action changes approval policies or trusts hooks on the user’s behalf.

Configuration locations:

| Agent       | Settings                                                                | Events                                                                                                                  |
| ----------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Codex       | `$CODEX_HOME/hooks.json`, otherwise `~/.codex/hooks.json`               | SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PermissionRequest, Stop, SessionEnd, Interrupt                 |
| Claude Code | `$CLAUDE_CONFIG_DIR/settings.json`, otherwise `~/.claude/settings.json` | SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PermissionRequest, Notification, Stop, StopFailure, SessionEnd |

After connecting, restart the agent. Codex requires review of the new hook definitions in `/hooks` or **Settings → Hooks**. A configuration marked “Hooks installed” does not establish that the agent has trusted it or sent an event. If hooks have been disabled by agent settings or managed policy, enable them in that agent before expecting signals. Start a new request to verify that a session appears. Moving the Buddy executable requires reconnecting it so the hook path is updated. Windows Codex hooks assume its default PowerShell environment; Claude Code selects PowerShell explicitly on Windows. Alternate Windows shells need separate acceptance.

The app’s `--buddy-agent-hook codex|claude` entry point runs before Tauri or single-instance startup. It consumes bounded JSON from stdin, writes a small status file, emits no output or decisions, and exits successfully even when an event cannot be recorded. It never launches the pet window. Hook timeout is two seconds. Claude hooks explicitly continue on failure.

Status is recorded per agent and session, with a project basename, a short activity label, and a timestamp. Prompts, transcripts, tool arguments, output, and full working-directory paths are discarded. Working and waiting sessions become **Signal quiet** after 15 minutes without an event, rather than claiming completion. Up to 40 sessions appear in the panel; records expire after 24 hours. Disconnected integrations do not contribute status to the panel or Ember’s cues. Completion means the response is ready, not that a build, task, or test succeeded.

Ember uses a working pose while an agent is active, rests roaming while it is working or needs input, shows a warm attention label when it needs input or reports an error, and performs a brief Happy reaction on completion outside a running focus session. Agent signals do not award focus progress or override an active focus timer.

The browser preview at `/buddy.html` uses optional sample clips and cannot collect system history or install agent hooks. Native permissions and integration behavior must be checked in the desktop app.

Implementation follows the [Tauri clipboard API](https://v2.tauri.app/plugin/clipboard/), [Codex hook configuration and trust](https://learn.chatgpt.com/docs/hooks), and [Claude Code hook reference](https://code.claude.com/docs/en/hooks). Installed Codex 0.169.0-alpha.11.1 and Claude Code 2.1.318 were inspected during development. Windows native acceptance remains separate from a successful macOS build.
