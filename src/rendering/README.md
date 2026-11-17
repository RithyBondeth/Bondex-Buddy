# Rendering

`habitat.ts` draws a static temporary sprite and ledge into a 110 × 100 Canvas displayed at 2×. It disables image smoothing and derives a binary hit mask from the final alpha pixels. The concept image is sampled into a maximum 48 × 48 area for testing; it is not an approved sprite sheet.

Future animation and particles should consume engine state; do not decide focus or idle behavior here. When animations change the visible silhouette, update the native mask along with the rendered frame.
