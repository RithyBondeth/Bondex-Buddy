# Tiny Desk Spirit asset provenance

The selected character is Ember fox. The original reference and four mood source illustrations were generated with OpenAI's built-in Imagegen during this project's design work. Runtime rendering samples them onto the shared pixel grid/palette; source PNGs are preserved. The mood prompts and reference relationship are recorded in `assets/pets/ember-fox/artwork/prompts.json` in the source repository.

- Runtime character sources: `assets/pets/ember-fox/reference.png` and `assets/pets/ember-fox/artwork/{working,sleeping,tea-break,happy}.png`.
- Walking, running, and play source sheets were generated with OpenAI's built-in Image Gen on 2026-11-19 using the original Ember reference; running and play also use the walking sheet as an identity reference. The preserved RGBA sources are `assets/pets/ember-fox/artwork/{walk,run,play}-cycle-v1.png`, with exact prompts and provenance in the sibling `*-cycle-v1.prompt.md` files. Each 1254 × 1254 sheet contains eight poses in a 4 × 2 layout. Runtime crops them onto 48 × 48 frames with the existing 16-color palette and binary alpha. Walking uses a nominal 880 ms stride, running 560 ms, and the play/pounce sequence 1500 ms; desktop travel controls the walking/running paw rate.
- Desktop icons were generated from the selected reference using the Tauri icon tool. The bundled icon files are in `src-tauri/icons/`.
- Shelf, plant, lantern, wardrobe cues, and particles are drawn by the project's Canvas code. Calm motion uses integer pixel row bands; roaming and play use the generated animation frames. Rendering does not alter the source PNGs.
- Rain and chimes are synthesized locally by the project's Web Audio code. No third-party recorded audio is bundled.
- Fonts are requested from operating-system font families; no font files are redistributed by the app.

The generated notices inventory covers third-party software dependencies, not a license grant for this project's code or generated artwork. The owner has not selected a project license. Final character, cosmetic, motion, and sound approval remain tracked in the roadmap.
