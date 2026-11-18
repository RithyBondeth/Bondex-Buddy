# Tiny Desk Spirit privacy

The current application has no accounts, analytics, telemetry, cloud saves, or application network calls. Development tooling and dependency installation use the network; app behavior does not require a server.

The activity observer reads elapsed system idle time every five seconds. It does not read key contents, record typing, inspect app names, or capture screens. Cursor position is used transiently for hit testing and Ghost Mode. The left mouse-button state is checked while dragging to detect release. These values are not logged or stored.

Local `progress.json` in the operating system's application-data directory contains completed focus-session totals, equipped decor/outfits, lighting preference, and Ghost Mode preference. It contains no activity history, input content, or focus timestamps. Browser previews use separate localStorage. Sound starts muted on each launch.

Launch at login is an explicit tray-menu option in release builds. It uses the OS startup mechanism through Tauri's autostart plugin, and is never automatically enabled. Debug builds disable the option so a development executable is not accidentally registered.

Audio is generated locally. No microphone permission or recordings are used. To remove local progress, quit the app and remove its `progress.json`; this resets rewards and preferences. OS login registration can be disabled through the tray option before removing the app.

The optional debug `native-test` feature creates an owned acceptance-test surface. It displays a transient click counter and coordinates for clicks on that surface, plus current window geometry and hit-test flags. These diagnostics are not saved or sent anywhere. The feature is inactive in normal builds and release builds, including release builds compiled with the feature enabled. It never enables OS login registration.

Relaunch handling uses local operating-system inter-process messaging. Forwarded command-line arguments and working directories are discarded by the application callback.
