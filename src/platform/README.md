# Desktop integration

`desktop.ts` registers the first rendered alpha mask, updates masks without revealing a hidden window, and reveals startup errors. It subscribes to native pointer proximity and idle-time samples, and updates the native control hit region. Browser previews skip native calls and explicitly report activity as unavailable.

The Rust activity observer polls every five seconds, including while hidden. Each payload contains only elapsed idle seconds (or null on failure) and its sampling timestamp. The frontend gets an initial snapshot after subscribing, so it does not wait for the next poll.

Keep future local persistence behind this boundary so the engine can run without a desktop window. Window placement, tray, and click-through live in the Rust shell.

OS-specific implementations belong in `src-tauri/src/`. Never collect typed content or screenshots.
