# Ember fox

Selected by the user on 2026-11-18. `reference.png` is the original pixel-art concept from `docs/design/concepts/ember-fox.png`, generated with Imagegen during the concept exploration.

The runtime uses this reference for Idle and the new `artwork/` images for Working (glasses and notebook), Sleeping (curled under a blanket), TeaBreak (mug), and Happy (raised paws and smile). The built-in Imagegen generated the four transparent source illustrations using the selected fox as their reference. Exact prompts and provenance are in [artwork/prompts.json](artwork/prompts.json).

Each source is cropped, sampled onto a maximum 48 × 48 grid, and mapped to the shared 16-color palette with binary alpha. Source PNGs remain untouched. Native WebView inspection confirmed all five rendered moods on 2026-11-18. These are integrated single-pose illustrations with runtime pixel breathing/reading/cup-lift/hop studies, not approved hand-authored animation sheets. Final animation and cosmetic visual approval remain open; see [motion review](../../../docs/verification/motion.md).

The Tauri icon tool generates desktop icons from the original reference. Beanie/scarf cues are provisional layers and are hidden while Sleeping.
