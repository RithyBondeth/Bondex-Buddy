# Rendering

`habitat.ts` caches two provisional poses per mood in 110 × 100 offscreen Canvases, displayed at 2× without image smoothing. Each pose has a cached alpha mask; identical silhouettes share the same mask reference, so native updates happen only when the interactive silhouette changes. There is no per-frame pixel readback.

Idle uses the selected reference; the other four moods use dedicated transparent artwork. Each source is sampled into a maximum 48 × 48 area, then `palette.ts` maps it to 16 shared colors and binary alpha. The original PNGs remain untouched. Sleeping uses a naturally curled pose rather than rotating an upright fox. Glasses/notebook and mug are part of the artwork. The slow body lift is still a prototype, not a hand-authored animation loop. `particles.ts` draws time-based steam, hearts, and sleep glyphs on top; those decorative pixels intentionally do not intercept clicks.

`AnimationClock` caps rendering at 30 fps and cancels its RAF loop while hidden or reduced motion is requested. Reduced motion uses a static pose without floating particles. Rendering consumes mood state; it does not decide focus, break, or progression rules. Final approved sprite sheets can replace the cached prototypes without changing the engine.
