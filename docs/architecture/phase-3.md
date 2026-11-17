# Phase 3 first slice

Phases 1 and 2 are merged through PRs #1 and #2. This first Phase 3 slice was merged through PR #3 after macOS and Windows CI passed. Remaining Phase 3 work is listed below.

## Implemented

- Cached two-pose prototypes for all five moods, using integer pixel positions and the existing temporary pet concept.
- Slow idle lift/blanket breathing, Working pen movement, TeaBreak mug movement, and a brief Happy bounce. These exercise the pipeline; they are not approved animation sheets.
- Time-based pixel steam, hearts, and sleep glyphs. Particles are decorative and deliberately click-through.
- A render loop capped at 30 fps, independent of the one-second timer UI update.
- Static poses and no floating particles under the OS reduced-motion preference, with no continuous RAF loop.
- Native visibility events from the existing shell worker; hidden windows stop the RAF loop and suspend audio. Browser previews use document visibility.
- An explicit sound toggle, muted by default. Original procedural filtered noise provides provisional rain; gentle sine chimes mark pet interaction and focus completion. A running focus still retains Working priority.
- Listener, frame, and audio cleanup on disposal/HMR. Audio allocation is lazy; pending resume cannot restart a disposed sound engine.

## Performance boundaries

The renderer creates masks only when caching a new pose. Cached poses with identical alpha silhouettes share a mask identity, so color-only changes and particle-only frames produce no mask upload. Idle/Working frames also skip Canvas painting while the pose is unchanged. Moving silhouettes still use the native 40 ms polling approximation from Phase 1.

The scheduler requests at most one RAF callback at a time, skips excess frames on high-refresh displays, and does not replay missed frames after a hidden interval. Reduced motion and hidden state cancel the render loop. The five-second native idle observer continues because it drives behavior, and the native shell continues its lower-rate hidden visibility checks.

These mechanisms are tested; total CPU/memory savings have not been measured. Profile both the Rust process and its WebView processes on macOS and Windows before setting a resource budget.

## Sound behavior

AudioContext creation/resume occurs directly from the sound button gesture. Startup and normal pet use remain silent until the user opts in. Hiding or muting stops scheduled chimes and suspends audio; showing resumes the selected ambient loop without replaying old tones. The setting is in memory only.

References: [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

## Verification

- Eighteen TypeScript tests pass: the twelve engine tests plus four scheduler lifecycle tests and two audio lifecycle/default-mute tests.
- Three native hit-testing/placement tests and local Rust Clippy pass.
- Browser sound toggling reaches the enabled state and returns to muted. This verifies control/API startup; subjective listening quality still needs review.
- A browser render harness displays all five moods and confirms that particle-only frames reuse the hit mask and reduced-motion frames have a stable silhouette.
- The compact toolbar was inspected and its enabled sound label shortened to fit without wrapping.
- The macOS Phase 3 bundle builds and launches; the native sound toggle enables and mutes successfully. A native screenshot shows the Sleeping test pose, sleep particles, and compact toolbar. Audio was returned to muted after testing.

## Remaining Phase 3 work

- Select the final pet, define its native grid/palette, and produce approved sprite sheets.
- Replace provisional cue geometry and sounds with approved art/Foley where needed.
- Dragging, edge snapping, and optional Ghost Mode.
- Native acceptance for animation, hover-to-controls, sound suspension/resume, reduced motion, and scaled click-through on macOS and Windows.
- Total resource profiling, listening tests, and final visual polish.

This is an incremental Phase 3 delivery; the remaining items above are still open.
