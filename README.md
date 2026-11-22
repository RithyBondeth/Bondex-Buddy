# Bondex Buddy · Tiny Desk Spirit

A quiet, pixel-art desktop companion for macOS and Windows, based on the project plan in `docs/`.

## Current stage

Phases 1–4 and the Ember fox desktop-polish follow-up are merged into `develop` through [PR #6](https://github.com/RithyBondeth/Bondex-Buddy/pull/6). Artwork and the native acceptance fixture are merged through [PR #7](https://github.com/RithyBondeth/Bondex-Buddy/pull/7); both macOS Intel and Windows CI passed. Native GUI acceptance remains separate from those automated checks.

The motion work is merged through [PR #8](https://github.com/RithyBondeth/Bondex-Buddy/pull/8), with macOS and Windows CI passing. Release notices are merged through [PR #9](https://github.com/RithyBondeth/Bondex-Buddy/pull/9), with macOS and Windows CI passing. The single-instance follow-up adds single-instance startup protection and macOS reopen handling. Relaunch requests restore the existing habitat and its in-memory session.

The refreshed notice inventory covers 278 packages and 178 distinct texts, with 15 evidence reviews open. Frontend checks, 33 TypeScript tests, eight notice-tool tests, five Rust tests, and Clippy pass locally. Native restore automation remains inconclusive. See [relaunch verification](docs/verification/relaunch.md) and [roadmap](docs/roadmap.md).

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

For the Canvas preview in a browser, run `npm run dev`. Open `/motion-review.html` on that server to review all five animations and preview cosmetics without altering saved progress. Native placement, transparency, tray, idle observation, and click-through must be checked in the Tauri app. Use the menu bar/system tray icon to **Show spirit**, **Hide spirit**, **Reset to bottom right**, **Move to next display**, or **Quit Tiny Desk Spirit**. On macOS, click the Bondex Buddy menu bar icon and choose **Settings…** for pet preferences, clipboard capture, agent connections, and launch at login.

Click Ember or press **Enter** while Ember has keyboard focus to open the thought bubble. The **Focus** tab holds the timer and reset control. Completing a focus session starts a five-minute break, then Ember returns to idle. Reset cancels the current session without recording a completion. Drag Ember or use the arrow keys to move the pet. Browser previews support the timer without simulating OS activity.

Sound starts muted on each launch. Turn it on in **Settings → Ember** for quiet rain and gentle chimes. Hidden habitats suspend audio and animation. The OS reduced-motion preference disables the animation loop and floating particles while keeping state changes and timer controls functional.

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

The first native build downloads and compiles the Rust dependencies and takes longer than later builds. Commit both `package-lock.json` and `src-tauri/Cargo.lock` for reproducible dependency resolution. Dependency notices are bundled automatically; run `npm run notices:generate` after changing dependencies and use `npm run notices:check` to verify freshness. Signing, notarization, and release distribution remain open.

## Folder structure

The Next.js landing page lives in [`website/`](website/README.md) as a separate npm package in this repository. To start it, run `cd website`, `npm ci`, and `npm run dev`. It showcases Ember with scroll-driven pixel transitions; the desktop app continues to use the root commands above.

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
website/                   Independent Next.js landing page package
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
