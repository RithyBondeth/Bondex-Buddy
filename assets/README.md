# Runtime assets

- `brand/`: Blue Jelly platform icon and macOS menu bar artwork.
- `pets/`: approved pet sprite sheets and animation metadata.
- `decor/`: approved habitat, outfit, and prop sprites.
- `audio/`: approved ambient loops and interaction sounds.

These folders are reserved for production assets. Import assets from TypeScript using Vite so the build tracks and hashes them. Keep concept references in `docs/design/concepts/`; they are not runtime sprite sheets.

Use lowercase kebab-case filenames. Keep source files and exported assets together in a named asset folder when they become available. Record authorship or generation source, license, native dimensions, palette, frame dimensions, and animation timings for each production asset.
