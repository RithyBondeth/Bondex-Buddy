# Pixel-art direction

Pixel art is the required visual style for the pet, habitat, props, particles, and wardrobe.

## Current status

Three generated pet concepts are stored in `concepts/`: ember fox, moon cat, and moss bunny. They are visual references only. Ember fox was selected on 2026-11-18. The renderer now uses a maximum 48 × 48 body grid and a shared 16-color palette. Four dedicated mood illustrations are integrated alongside the Idle reference. Final approved source sheets and animation frames are still pending; see [the artwork/native report](../verification/artwork-native.md).

The concept PNGs are large generated previews, not grid-accurate runtime sprite sheets. Production assets need a consistent source pixel grid and palette cleanup before animation. Do not directly treat a generated preview as a finished animated sprite.

## Production guidelines

- Compose the character on its maximum 48 × 48 source grid, then reduce the assembled pose to half size with nearest-neighbor sampling. The 110 × 100 habitat Canvas is displayed at 2×. The 16-color body/blanket palette is defined in `src/rendering/palette.ts`; props and UI have separate palettes.
- Use crisp square pixels, a consistent outline weight, and a small documented palette.
- Use flat color clusters; avoid gradients, blur, antialiasing, and texture noise.
- Keep facial expressions readable at the intended desktop size.
- Preserve a consistent body shape, origin, baseline, and frame size across animations.
- Export PNGs with real transparency and no baked-in background.
- Scale sprites by integer factors. Set Canvas `imageSmoothingEnabled = false`; CSS alone is not enough for Canvas drawing.
- Keep pet, habitat, wardrobe, and effects on separate layers.
- Reserve space within the planned 220 × 200 widget for the habitat and hover controls.

## Animation sequence after pet selection

1. Approve a clean idle sprite at native size and an enlarged nearest-neighbor preview.
2. Produce a short breathing/blinking idle loop.
3. Add Working, Sleeping, TeaBreak, and Happy poses using the same grid and palette.
4. Add layered accessories and particles after the core states are readable.

This is a planning sequence, not completed art or animation work.
