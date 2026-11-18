# Release notices follow-up

[PR #8](https://github.com/RithyBondeth/Bondex-Buddy/pull/8) merged the fox motion work into `develop` as `e66802c156bdf092d4bf44b26773cfe1b7cdd796`, after macOS and Windows CI passed. The `bondeth/release-notices` follow-up adds dependency/asset notices and packaging integration.

## Implemented

- A deterministic inventory covering 274 Cargo packages across the supported macOS ARM64/Intel and Windows x64 MSVC target graphs, plus the Tauri JavaScript API and Vite's emitted module-preload helper: 276 entries total.
- 177 distinct copied license/notice texts, deduplicated by SHA-256 while retaining each package's original filenames, license expressions, source repository, target list, and immutable upstream evidence URLs where applicable.
- Five archive omissions covered by version/revision-pinned upstream snapshots: `alloc-stdlib`, `tauri-plugin`, and the three WebView2 Rust packages. Original source URLs and stored-text hashes are in [the supplement index](../../third-party/supplements.json).
- An asset provenance notice for generated character artwork, derived app icons, Canvas props/motion, locally synthesized audio, and system fonts.
- Freshness checks in CI and before native packaging. A stricter text-presence command reports unresolved evidence separately. Generated files are bundled under `third-party/`, and the unsigned packaging workflow stages an additional standalone copy beside the artifacts.
- Filesystem protections and tests for dependency selection, original text bytes, path traversal/symlink boundaries, deterministic output, pinned supplements, build-emitted helpers, stale files, and preservation of unmanaged files. Existing repository newline/binary rules are retained.

## Verified locally

Eight Node notice-tool tests and all 33 TypeScript tests pass. Frontend type checking, lint, formatting, notice generation/freshness checks, and normal macOS debug packaging pass. The app's `Contents/Resources/third-party/` inventory and copied text hashes match the generated source snapshot. The stricter text-presence command correctly reports the 15 unresolved entries.

Windows execution of the new notice tooling and NSIS resource installation still require CI/native validation on this follow-up. The manual unsigned release workflow remains configured but has not been dispatched for these changes.

## Remaining evidence and release work

Fifteen entries remain flagged: fourteen Objective-C binding packages and `selectors` 0.38.0. The Objective-C project provides [upstream licensing notes](https://github.com/madsmtm/objc2/blob/7b1abfd750a2cacaea71d6a56ecfb83cb7de560b/LICENSE.md); `selectors` carries an MPL-2.0 statement in its [source header](https://github.com/servo/stylo/blob/572ecba2d1600e7c3d490586692a209faf703baa/selectors/lib.rs). Standalone text/source-notice curation for these entries is still open. The generator preserves the declared expressions and records gaps rather than manufacturing copyright notices or choosing a project license.

Project licensing, final artwork/audio approval, native pointer/Windows GUI acceptance, mixed-DPI hardware, resource profiling, real installed login behavior, signing/notarization, and installer review remain open in [release preparation](../release.md) and the [roadmap](../roadmap.md).
