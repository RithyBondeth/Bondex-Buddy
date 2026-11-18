# Tiny Desk Spirit asset provenance

The selected character is Ember fox. The original reference and four mood source illustrations were generated with OpenAI's built-in Imagegen during this project's design work. Runtime rendering samples them onto the shared pixel grid/palette; source PNGs are preserved. The mood prompts and reference relationship are recorded in `assets/pets/ember-fox/artwork/prompts.json` in the source repository.

- Runtime character sources: `assets/pets/ember-fox/reference.png` and `assets/pets/ember-fox/artwork/{working,sleeping,tea-break,happy}.png`.
- Desktop icons were generated from the selected reference using the Tauri icon tool. The bundled icon files are in `src-tauri/icons/`.
- Shelf, plant, lantern, wardrobe cues, and particles are drawn by the project's Canvas code. Motion is implemented by integer pixel row bands; it does not alter source illustrations.
- Rain and chimes are synthesized locally by the project's Web Audio code. No third-party recorded audio is bundled.
- Fonts are requested from operating-system font families; no font files are redistributed by the app.

The generated notices inventory covers third-party software dependencies, not a license grant for this project's code or generated artwork. The owner has not selected a project license. Final character, cosmetic, motion, and sound approval remain tracked in the roadmap.
