# Bondex Buddy · Tiny Desk Spirit

A quiet, pixel-art desktop companion for macOS and Windows, based on the project plan in `docs/`.

## Current stage

Phases 1–4 and the Ember fox desktop-polish follow-up are merged into `develop` through [PR #6](https://github.com/RithyBondeth/Bondex-Buddy/pull/6). Both hosted macOS Intel and Windows CI jobs passed for PR #6. Native GUI acceptance remains separate from those automated checks.

The artwork/native-testing follow-up integrates four dedicated Ember fox mood illustrations, a shared 48-pixel/16-color runtime treatment, and an optional debug native acceptance fixture. Final animation sheets and cosmetic artwork still need review.

Passed locally: 27 TypeScript tests, five native tests, frontend checks/build, Rust Clippy with all features, and normal macOS debug packaging. The native WebView renders all five moods, and a shelf-keyboard movement check confirms a 24-logical-pixel change at scale 2. Native mouse acceptance remains inconclusive because coordinate automation reported window-location and screen-capture errors. Windows GUI checks, full profiling, signing, and distribution remain open. See the [artwork/native report](docs/verification/artwork-native.md), [roadmap](docs/roadmap.md), and [release preparation](docs/release.md).

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
assets/                    Runtime assets and preserved source artwork
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
  engine/                  Mood, timer, and progression logic
  rendering/               Canvas renderer, palette, animation, particles
  platform/                Typed desktop startup adapters
  styles/                  Shared styles and pixel rendering rules
  testing/                 Optional native acceptance surface
src-tauri/
  capabilities/            Explicit frontend permissions
  icons/                   Ember fox app icons
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

Read the [architecture](docs/architecture/overview.md), [art direction](docs/design/art-direction.md), and [roadmap](docs/roadmap.md) for the next implementation and acceptance steps.
