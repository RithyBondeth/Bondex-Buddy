# Phase 2 verification

## Checks completed locally

- Twelve deterministic TypeScript tests cover mood priority, sustained activity, sleep/night boundaries, return from away, happy expiry, focus/break completion, pause/resume/reset, delayed callbacks, backward clock changes, stale input, and countdown formatting.
- Three native unit tests cover scaled hit masks, monitor work-area docking, and hidden/visible control hit regions.
- Browser interaction checks confirm keyboard access to controls, Start → Working, Pause → frozen countdown, Resume → Working, Reset → Idle, and petting → Happy outside focus.
- The paused browser countdown was read in separate interactions and stayed unchanged.
- Petting during a running focus session preserved Working and the running timer.
- Browser screenshots confirm the hover toolbar, mood caption, pixel-art test pet, and Working test cues render without startup errors.
- The Phase 2 macOS debug bundle builds and launches. Its native UI reports system idle readings as available.
- Native macOS Start/Pause/Resume/Reset actions update the state correctly. A native window screenshot succeeded after restarting the app and shows the pixel-art pet and ledge.

Phase 1 CI passed on macOS and Windows before PR #1 was merged. Phase 2 CI checks the new code on both platforms, but compilation and unit tests do not replace native Windows activity and click-through acceptance checks.

## Native acceptance still required

Native screen capture failed during Phase 1 inspection, then succeeded for the Phase 2 window after restart. The native controls and idle-reading availability are confirmed on macOS, but duration-based activity transitions, cross-window click-through, and Windows behavior still need acceptance testing:

- [ ] Hover into the habitat through empty pixels; move to Start across the transparent gap and verify the toolbar stays reachable.
- [ ] Leave the habitat and move focus to another app; verify controls hide and empty space passes clicks through.
- [x] Verify Start, Pause, Resume, and Reset in the native macOS window.
- [ ] Verify Start, Pause, Resume, and Reset in the native Windows window.
- [ ] Start focus and pet the sprite; confirm the timer keeps running and Working has priority.
- [ ] Type/move the pointer regularly for more than 15 seconds without a manual timer; verify Working, then Idle when activity stops briefly.
- [ ] Leave the system idle for five minutes and verify Sleeping.
- [ ] Return after an observed ten-minute idle period and verify a brief TeaBreak.
- [ ] Complete a 25-minute focus and verify a five-minute break, then Idle without another focus cycle.
- [ ] Hide during a session, wait for a mood transition, and confirm the window stays hidden until Show is selected.
- [ ] Suspend/resume the machine across timer deadlines and verify no duplicate completions.
- [ ] Check 23:30 and 06:00 night boundaries without an active focus timer.
- [ ] Repeat hover, controls, and click-through checks at multiple display scales and on multiple monitors.

Full sprite animations, particle motion, Foley, local saves, wardrobe, and unlocks are not part of this phase.
