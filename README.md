# Bondex Buddy · Tiny Desk Spirit

A quiet, pixel-art desktop companion for macOS and Windows, based on the project plan in `docs/`.

## Current stage

Phases 1–4 have published code in `develop` through PRs #1–#4. PR #4 passed Windows CI and local macOS checks; hosted macOS CI was queued at merge and later cancelled because no runner could be acquired. CI-only PR #5 changes the runner label and removes duplicate feature runs; hosted Mac validation remains pending. Those milestones still have open acceptance/art tasks in the roadmap.

The current local follow-up uses the selected **Ember fox**, adds shelf movement/snapping, optional native Ghost Mode, outfit unlocks with versioned save migration, and an opt-in release-build launch-at-login tray item. It also adds privacy documentation and a manual unsigned packaging workflow. These new changes are not committed or pushed yet.

Passed locally: 25 TypeScript tests, five native tests, frontend checks/build, Rust Clippy, and macOS debug packaging. Native pointer acceptance, clean production artwork, full resource profiling, signing, and distribution remain open. See the [desktop polish notes](docs/architecture/desktop-polish.md), [roadmap](docs/roadmap.md), and [release preparation](docs/release.md).

## Requirements

- Node.js 24+ and npm (`nvm use` selects Node 24 from `.nvmrc`).
- Rust stable installed through [rustup](https://rustup.rs/).
- macOS: Xcode Command Line Tools (`xcode-select --install`).
- Windows: Visual Studio Build Tools with **Desktop development with C++**, Windows SDK, and Microsoft Edge WebView2 Runtime.

See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for platform setup. Build each desktop package on its target OS.

## Start developing

```sh
npm ci
npm run desktop:dev
```

For the Canvas preview in a browser, run `npm run dev`. Native placement, transparency, tray, idle observation, and click-through must be checked in the Tauri app. Use the menu bar/system tray icon to **Show spirit**, **Hide spirit**, **Reset to bottom right**, **Move to next display**, or **Quit Tiny Desk Spirit**.

Hover over the habitat (or focus the pet with the keyboard) to reveal **Start/Pause/Resume** and **Reset**. A completed focus starts one five-minute break; finishing the break returns to idle. Reset cancels the current session without completion. Clicking the pet gives a two-second Happy reaction, except during a running focus session. Browser previews support the timer but do not simulate OS activity.

Sound starts **Muted**. Enable it explicitly for quiet procedural rain and gentle pet/completion chimes; the setting is not saved yet. Hidden habitats suspend audio and animation. The OS reduced-motion preference disables the animation loop and floating particles while keeping state changes and timer controls functional.

## Commands

| Command                                                                                   | Purpose                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------- |
| `npm run desktop:dev`                                                                     | Run the native app with frontend hot reload |
| `npm run dev`                                                                             | Run the frontend development server         |
| `npm run check`                                                                           | Check TypeScript, lint, and formatting      |
| `npm test`                                                                                | Run deterministic engine and timer tests    |
| `npm run build`                                                                           | Build frontend assets into `dist/`          |
| `npm run format`                                                                          | Format frontend files and documentation     |
| `npm run desktop:build`                                                                   | Build the desktop app and native bundle     |
| `cargo check --locked --manifest-path src-tauri/Cargo.toml`                               | Check Rust code and dependencies            |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml`                                | Test hit-mask coordinates and docking       |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`                               | Check Rust formatting                       |
| `cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Lint Rust code                              |

The first native build downloads and compiles the Rust dependencies and takes longer than later builds. Commit both `package-lock.json` and `src-tauri/Cargo.lock` for reproducible dependency resolution. Signing, notarization, and release distribution are not configured yet.

## Folder structure

```text
assets/                    Runtime assets (including a temporary test pet)
  pets/                    Sprite sheets and animation metadata
  decor/                   Habitat, outfits, and props
  audio/                   Ambient loops and interaction sounds
docs/
  architecture/            Stack decisions and layer boundaries
  design/                  Pixel-art rules and concept references
  roadmap.md               Milestones and acceptance checks
  *.pdf                    Original project plan
src/
  app/                     Startup and application wiring
  engine/                  Future mood, timer, and progression logic
  rendering/               Canvas renderer; future animation
  platform/                Typed desktop startup adapters
  styles/                  Shared styles and pixel rendering rules
src-tauri/
  capabilities/            Explicit frontend permissions
  icons/                   Temporary scaffold app icons
  src/                     Native Rust entry points and OS integration
```

## Development rules

- Use TypeScript for the frontend and Rust for native integration.
- Keep the engine independent of UI and OS APIs.
- Use pixel art consistently; disable image smoothing and scale sprites by whole numbers.
- Keep access permissions narrow and add them when a feature needs them.
- Never record keystroke contents, screenshots, or user activity history. Future activity observation should expose only active/idle signals.
- Keep data local. No accounts, analytics, cloud storage, or external APIs are needed for the planned app.
- Add focused behavior tests when implementing the engine and timer. Use manual desktop checks for transparency, placement, tray, and click-through behavior.

Read the [architecture](docs/architecture/overview.md), [art direction](docs/design/art-direction.md), and [roadmap](docs/roadmap.md) before implementing the first milestone.
