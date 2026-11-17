# Rendering

`habitat.ts` caches the temporary sprite on a small offscreen Canvas and redraws a test pose only when the mood changes. It uses a 110 × 100 Canvas displayed at 2×, disables image smoothing, and derives a binary hit mask from the final alpha pixels after every redraw.

The concept image is sampled into a maximum 48 × 48 area for testing; it is not an approved sprite sheet. Working glasses/notebook, a Sleeping test pose/blanket, a TeaBreak mug, and a static Happy heart are provisional code-drawn cues for testing the FSM. Full sprite sheets and animation loops remain Phase 3 work.

Future animation and particles should consume engine state; do not decide focus or idle behavior here. When animations change the visible silhouette, update the native mask along with the rendered frame.
