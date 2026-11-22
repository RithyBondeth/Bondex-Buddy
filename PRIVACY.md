# Tiny Desk Spirit privacy

The current application has no accounts, analytics, telemetry, cloud saves, or application network calls. Development tooling and dependency installation use the network; app behavior does not require a server.

The activity observer reads elapsed system idle time every five seconds. It does not read key contents, record typing, inspect app names, or capture screens. Cursor position is used transiently for hit testing and Ghost Mode. The left mouse-button state is checked while dragging to detect release. These values are not logged or stored.

Local `progress.json` in the operating system's application-data directory contains completed focus-session totals, equipped decor and outfits, lighting and Ghost Mode preferences, and tasks you add. Saved tasks include their titles, completion state, focus-session counts, and any scheduled reminder. Choosing **Task** on a clipboard entry saves up to 120 characters of that entry as a task title. System activity history and focus start and end times stay out of the file. Browser previews use separate localStorage. Sound starts muted on each launch.

Launch at login is an explicit option in menu bar or tray Settings in release builds. It uses the OS startup mechanism through Tauri's autostart plugin, and is never automatically enabled. Debug builds disable the option so a development executable is not accidentally registered.

When you connect an agent in Settings, Bondex Buddy stores its provider, session identifier, project folder name, activity, timestamps, reported model identifier, and observed usage counters locally. Records expire 24 hours after the latest signal. Gemini CLI may report token counts in its hooks. The optional Codex and Claude token usage setting reads up to 2 MiB from the end of those agents’ active session logs to extract numeric token counters. Buddy discards prompts, conversation text, tool inputs and outputs, and full working-directory and log paths. Turning the setting off stops these log reads and hides their token totals.

Audio is generated locally. No microphone permission or recordings are used. To remove local progress, quit the app and remove its `progress.json`; this resets rewards and preferences. OS login registration can be disabled in Settings before removing the app.

The optional debug `native-test` feature creates an owned acceptance-test surface. It displays a transient click counter and coordinates for clicks on that surface, plus current window geometry and hit-test flags. These diagnostics are not saved or sent anywhere. The feature is inactive in normal builds and release builds, including release builds compiled with the feature enabled. It never enables OS login registration.

Relaunch handling uses local operating-system inter-process messaging. Forwarded command-line arguments and working directories are discarded by the application callback.
