# Core engine

`spirit.ts` owns the deterministic mood state machine and focus/break clock. It accepts injected wall-clock times, local minutes of day, and high-level OS idle samples. It never calls the DOM, Canvas, Tauri, or OS APIs.

Run `npm test` for fake-clock tests of priorities, timer completion, pause/resume/reset, suspended callbacks, stale activity, night boundaries, and return-from-away behavior. Full behavioral defaults are in `docs/architecture/phase-2.md`. Cosmetic progression and persistence remain Phase 4 work.
