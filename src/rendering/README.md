# Rendering

`habitat.ts` caches two provisional poses per mood in 110 × 100 offscreen Canvases, displayed at 2× without image smoothing. Each pose has a cached alpha mask; identical silhouettes share the same mask reference, so native updates happen only when the interactive silhouette changes. There is no per-frame pixel readback.

The concept is sampled into a maximum 48 × 48 area. The slow body lift, moving pen/mug, and breathing blanket are test prototypes, not final sprite animation. `particles.ts` draws time-based steam, hearts, and sleep glyphs on top; those decorative pixels intentionally do not intercept clicks.

`AnimationClock` caps rendering at 30 fps and cancels its RAF loop while hidden or reduced motion is requested. Reduced motion uses a static pose without floating particles. Rendering consumes mood state; it does not decide focus, break, or progression rules. Final approved sprite sheets can replace the cached prototypes without changing the engine.
