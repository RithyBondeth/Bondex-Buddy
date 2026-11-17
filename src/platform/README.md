# Desktop integration

`desktop.ts` registers the rendered alpha mask with the native shell and reveals the window once the Canvas is ready. It also reveals a startup error if the sprite cannot load. Browser previews skip native calls.

Keep future activity signals and local persistence behind this boundary so the engine can run without a desktop window. Window placement, tray, and click-through currently live in the Rust shell.

OS-specific implementations belong in `src-tauri/src/`. Never collect typed content or screenshots.
