# Ember’s desktop tools

Click Ember to open a compact thought bubble with **Focus**, **Clips**, **Files**, and **Agents**. Right-click Ember, press **U** while it has keyboard focus, or use a menu bar shortcut to open it directly to a tool. **Escape**, the close button, or clicking Ember collapses the bubble while preserving the timer and search.

On macOS, click the Bondex Buddy menu bar icon and choose **Settings…**. Settings holds decor, outfits, lighting, sound, Ghost Mode, playful roaming, launch at login, clipboard capture, and agent connections. On Windows, open Settings from the tray menu. Launch at login is available in release builds.

The native window grows from 220 × 200 to at most 264 × 256 logical pixels within the display’s work area. The extra area appears above and to the left of the pet. Drag Ember or the shelf to move it. Arrow keys also move the pet when it has focus. Closing the bubble keeps the latest position. Roaming pauses while the bubble is open and retains its enabled preference. The rounded bubble and pet silhouette receive clicks. The decorative dots and surrounding transparent areas pass clicks through. Longer lists scroll inside the bubble.

## Clipboard

Capture is off until **Clipboard capture** is turned on in Settings. The native observer samples plain text every 900 ms, including while the panel is hidden. Starting or resuming capture establishes a baseline and excludes the text already on the clipboard. Images and other non-text formats are skipped. Text exceeding 16,384 UTF-8 bytes is skipped.

The history holds up to 50 unique clips, with up to 20 pins. Repeated text updates its recency; pinned snippets sort first. Search and the Pinned filter can be combined. Copy writes an existing clip to the system clipboard; it does not simulate a paste or change the foreground application. Removing or clearing entries does not cause an unchanged clipboard to be captured again. Clear all includes pins and requires a second click within four seconds.

Recent history stays in process memory and clears when the app quits. Only the capture preference and explicitly pinned snippets are saved in `clipboard.json` under Tauri’s app-data directory. Pinned text is stored as local JSON, not encrypted. Pausing stops observation and leaves existing clips available. Clipboard text is never sent to an agent or network service. Capture includes copied plain text from all apps, so pause it before copying anything you do not want in history. Password detection and per-app exclusions are not implemented.

Clipboard mutations are serialized. Persistent edits save before updating in-memory state, and invalid or unsupported files are preserved with capture disabled. Atomic writes use a same-directory temporary file with owner-only permissions on Unix. The frontend copies clipboard entries by their existing clip IDs. Ember’s window reads clipboard history and edits clips. Clipboard capture and agent connections are managed from Settings.

## Files

Ember accepts desktop file drops on the pet and the open thought bubble. The pouch keeps up to 50 individual files and 2 GB of local copies. The **Files** tab shows each copy’s size and time remaining. Drag the file name into Finder, File Explorer, or another app that accepts files. **+24h** extends a copy’s stay and **Remove** clears it from the pouch.

The desktop shell handles inbound file paths and stages each complete copy before adding it to the list. The thought requests native drag-out by entry ID. Copies expire after 24 hours unless extended, and cleanup waits for an active drag to finish.

## Tasks and reminders

The Focus tab contains **Tasks**. Tasks are stored with local progress and can be checked off, restored, or removed from Completed. Starting Focus on a task associates that task with the timer and records a session after the focus phase finishes. The Clipboard tab offers **Task** to create a to-do from the selected clip.

A reminder uses the machine’s local date and time at scheduling. Ember shows due reminders while the pet is running, including after reopening the app. Click Ember to snooze a reminder for 10 minutes or dismiss it. Completing a task clears its reminder.

## Agent activity and usage

**Connect** adds a local observer to the provider’s user-level hooks. Buddy saves an owner-only backup of an existing settings file and preserves other hooks, including Bondex Notch hooks. **Disconnect** removes Buddy’s entries. Restart a provider after connecting and, for Codex, review the hooks in `/hooks` or Settings → Hooks.

| Agent       | Settings                                                                     | Usage available in Buddy                                              |
| ----------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Codex       | `$CODEX_HOME/hooks.json` or `~/.codex/hooks.json`                            | Observed requests and tool calls. Optional session token counts.      |
| Claude Code | `$CLAUDE_CONFIG_DIR/settings.json` or `~/.claude/settings.json`              | Observed requests and tool calls. Optional session token counts.      |
| Gemini CLI  | `~/.gemini/settings.json` under the home set by `GEMINI_CLI_HOME` if present | Observed requests, tool calls, model invocations and reported tokens. |
| Antigravity | `~/.gemini/config/hooks.json`                                                | Observed model invocations and tool calls.                            |
| Cursor      | `~/.cursor/hooks.json`                                                       | Observed requests, tool results, failures and reported thinking time. |

The `--buddy-agent-hook` entry point consumes bounded JSON before Tauri starts. It saves the provider, session identifier, project folder name, model identifier if available, activity, timestamps, and supported counters. Cursor uses local Agent Chat hooks. Antigravity uses the documented hooks shared by its app, CLI and IDE. Account quotas and billing require the provider’s own usage surface.

**Current work** shows live and waiting sessions only. Completed or quiet sessions leave this view. A live signal goes quiet after 15 minutes without an update. **Usage** aggregates observed counters from retained sessions per provider and shows tokens for the most recent session with a token report. A record expires 24 hours after its last signal. Session details show the project, model, elapsed turn time, tool counts, and reported token totals where available.

**Handoffs** shows recent responses and requests for input. Completed signals can be dismissed from the thought, and handoffs expire 15 minutes after their last signal. The Codex shortcut sends a local chat link to the desktop app. Buddy can copy CLI resume commands for Codex, Claude Code, Gemini CLI, or Antigravity and can copy the observed Cursor conversation ID. Copy actions leave the choice of when to resume with the user.

The optional **Codex and Claude token usage** setting reads numeric usage fields from the current session’s transcript under that provider’s log directory. It reads up to 2 MiB from the log’s end, so large Claude logs show recent tokens. Gemini token counts come from its model hooks. Buddy never saves log paths or conversation contents. Moving Buddy requires reconnecting the provider so it can find the executable.

Ember animates the mascots of agents that are working. When two agents work at the same time, their mascots appear side by side, with project and activity details on hover or keyboard focus. Agents shares Ember’s thought with Focus and Clipboard.

The browser preview at `/buddy.html` uses optional sample clips. Agent connection and local usage collection run in the desktop app.

See the [Codex hooks](https://learn.chatgpt.com/docs/hooks), [Claude Code hooks](https://code.claude.com/docs/en/hooks), [Gemini CLI hooks](https://geminicli.com/docs/hooks/reference/), [Antigravity hooks](https://antigravity.google/docs/hooks), and [Cursor hooks](https://cursor.com/docs/hooks) for provider contracts.
