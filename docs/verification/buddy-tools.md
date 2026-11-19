# Desktop utility verification

## Automated checks

- `npm run check`: TypeScript, ESLint, and Prettier pass. The generated Impeccable hook cache is excluded from formatting.
- `npm test`: 52 tests pass, including clipboard search, pin ordering, and timestamp formatting.
- `npm run notices:test`: eight notice-tool tests pass.
- All-features Rust tests: 28 pass on macOS (27 on Windows; the symlink regression is Unix-only), including escaped maximum-size pin round-trips, baseline exclusion, unchanged-clipboard deduplication after deletion/clear, pin limits, pause/resume behavior, pins-only persistence, additive/idempotent hook setup, settings backups and size bounds, symlink preservation, metadata redaction, connected-session filtering, bounded shared locks, stale states, expiry, pocket sizing, and offset-pet/sheet hit regions.
- Rustfmt and Clippy run with warnings denied.
- Notice generation covers 296 packages and 193 distinct license texts. The 15 previously tracked evidence reviews remain; the new clipboard-win license is pinned to its published revision in `supplements.json`.
- The frontend production build and debug macOS app bundle build succeed.

## Observed on macOS

- Clicking Ember or Tools expands its own native window into a pet-attached pocket; right-click opens the Clipboard tab directly.
- The panel starts with capture off, an empty list, a searchable input, a Pinned filter, and clear capture/storage guidance.
- The Agents tab shows separate Connect controls for Codex and Claude Code inside the pet’s pocket.
- Native expansion, attached layout, and collapse were observed in the macOS app. Existing Claude Code session states appeared in the Agents tab; Codex remained disconnected.
- A browser preview with explicitly loaded samples supports search and pinning; pinning preserves focus on the corresponding action. Arrow keys switch tab selection and focus. The attached Focus controls start the timer, and collapsing the pocket retains the running session. A narrow browser viewport has no horizontal overflow (the in-app browser clamps the requested width to 400 CSS pixels).
- Both native `--buddy-agent-hook` receiver modes consume synthetic permission events, exit successfully without stdout/stderr, record the correct agent/session/project/waiting state, and exclude test prompt/tool values. Observed cold/warm runs were approximately 711 ms / 16 ms, below the two-second hook timeout. Synthetic files were removed afterward.

The smoke test does not establish an agent's trust or its end-to-end hook delivery. Actual personal clipboard capture and user agent settings were left opt-in.

## Manual acceptance still needed

- [ ] Enable capture, copy text in another app, and verify arrival, copy-again, pin/restart persistence, pause/resume, and clear on macOS and Windows.
- [ ] Confirm image-only/empty clipboards are skipped and a clipboard temporarily held by another app recovers.
- [ ] Check tray left-click, right-click menu, panel close/reopen, and pet keyboard shortcut on Windows.
- [ ] Connect each installed agent, restart it, review Buddy's hooks in Codex, and verify working → needs input → working → response-ready with actual requests.
- [ ] Confirm Bondex Notch and other pre-existing hooks continue working after setup and disconnect.
- [ ] Confirm the status panel and Ember's cues do not interrupt a running focus session or award focus progress.
- [ ] Check Windows PowerShell hook execution, app packaging, and any alternate agent shell/configuration layout.

See [setup and behavior](../architecture/buddy-tools.md) for the feature contract and current limitations.
