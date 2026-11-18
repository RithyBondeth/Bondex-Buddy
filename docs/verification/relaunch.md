# Relaunch follow-up

PR #9 merged the release notices into develop as `cb8036b79810530a2402fbc1b69c46532ebc53fd` after macOS and Windows CI passed. The `bondeth/single-instance-relaunch` branch adds relaunch handling.

The Tauri 2-compatible single-instance plugin 2.5.5 is registered first. Its callback restores the existing main WebView. macOS LaunchServices reopen events use the same restoration function. Tray Show and the debug fixture also use that function. Restore unminimizes and shows the existing window, retaining its engine and placement. Plugin initialization follows the [official integration guidance](https://v2.tauri.app/plugin/single-instance/).

The dependency notices were regenerated and now cover 278 packages and 178 distinct texts. Fifteen license-evidence reviews remain open.

Frontend checks, 33 TypeScript tests, eight notice-tool tests, five Rust tests, and Clippy passed locally. The normal native app launched and its focus timer started and reset successfully. Native hide/reopen verification remains inconclusive because Finder capture failed and the fixture did not confirm restoration. An added startup readiness guard could suppress explicit Show requests and was removed. The normal macOS debug bundle built successfully after that correction.

Repeat duplicate-executable launch, Finder reopen, hidden/minimized restoration during focus, quit/restart, and concurrent cold launches on macOS and Windows. Debug and release builds share the application identifier, so quit the running build before switching between them. Installed login behavior and the broader native acceptance checklist remain open.
