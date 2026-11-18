# Dependency notice sources

`generated/` contains the distributable inventory, copied texts, and asset provenance. Regenerate it with `npm run notices:generate` after `npm ci`. `npm run notices:check` verifies that these files still match the installed locked dependencies, target graphs, asset notice, and curated evidence. A desktop build performs that check automatically.

The Cargo inventory is the union of normal/build dependency edges for macOS ARM64, macOS Intel, and Windows x64 MSVC. It includes build-time crates and excludes development-only edges. The npm inventory follows runtime/peer dependencies and explicitly listed build-emitted helpers; Vite is included because its module-preload polyfill appears in the frontend output. Development-only npm tools are excluded.

`runtime-helpers.json` records those helper packages. `supplements.json` maps exact crate versions to upstream text snapshots in `upstream/`. Each snapshot records the package's published VCS revision, declared license, immutable source URL, and SHA-256. Updating dependencies requires reviewing these mappings; stale or unused evidence fails generation. The script fetches package metadata through Cargo but never downloads upstream license snapshots automatically.

The current inventory has 276 packages, 177 distinct text files, and 15 unresolved license-evidence entries. Fourteen belong to the Objective-C binding family; the other is `selectors` 0.38.0. The unresolved list is present in both generated Markdown and JSON. Upstream licensing notes/source headers need curation before completing distribution notices. No project license has been selected.

`npm run notices:require-texts` additionally fails while any inventoried package lacks a declared license or collected standalone text. Normal freshness checks allow those explicitly tracked reviews, so unsigned QA builds remain available. The manual packaging workflow includes the generated files inside the app and stages a standalone copy beside its bundle artifacts with `npm run notices:stage`.

Generated snapshots preserve source text bytes and use content-addressed filenames. Git attributes disable newline conversion for those files; formatting tools exclude them. The collector checks package boundaries, rejects escaping symlinks, and preserves unmanaged files when regenerating.
