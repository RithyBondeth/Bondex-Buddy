# Bondex Buddy website

The Next.js landing page for Bondex Buddy, featuring Blue Jelly, Ember fox, Moon cat, Moss bunny, and the Avengers. The split-canvas and pointer-reactive grid components are adapted from the supplied Hyperiux Vault examples.

## Develop

Use Node.js 24+ and npm, matching the desktop project.

```sh
cd website
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Edit `src/app/page.tsx` for the homepage, `src/app/layout.tsx` for metadata and the shared layout, and `src/app/globals.css` for global styles. Tailwind CSS is configured. Put future public assets in `public/`.

## Validate and build

```sh
npm run check
npm test
npm run build
npm start
```

`check` runs TypeScript, ESLint, and Prettier. `build` creates a production build; `start` serves it locally. Run `npm run format` to format this package.

## Repository and deployment

This folder is an independent npm package in the existing Git repository, with its own lockfile and configuration. Install its dependencies separately from the desktop app. Run desktop commands from the repository root.

For a future Next.js hosting project, select this repository and set its root directory to `website`, install command to `npm ci`, and build command to `npm run build`. No hosting project or deployment has been created. No environment variables are required by the scaffold.

See the [Next.js documentation](https://nextjs.org/docs/app/getting-started) for framework conventions.

## Components and design

- `src/components/ui/split-canvas.tsx`: reusable client component with a Three.js shader. Each item gets a full-height section; scrolling transitions between the local transparent images with feathered pixel rows.
- `src/components/ui/grid-pulse.tsx`: pointer-reactive canvas grid with an eased multicolor spotlight, faint background pulses, text avoidance, and offscreen and reduced-motion support.
- `src/components/companion-hero.tsx` and `companion-hero.css`: a framed pixel habitat with selectable desk spirits and Avengers, scene transitions, and compact selection controls. Hero styles are kept beside the component.
- `src/components/focus-playground.tsx`: interactive focus/break/rest preview with start, pause, resume, and reset. Countdown uses a wall-clock deadline so background throttling does not lose elapsed time.
- `src/components/motion-preferences.tsx`: shared motion preference, honoring both the OS setting and the page’s pause button.
- `src/components/ui/living-pet.tsx`: keyboard/touch-accessible pet preview with a 30 fps capped pixel Canvas, opacity-based pointer hit testing, a delayed hover greeting, and finite head-pat reactions. Breathing and blinking stop offscreen, in hidden tabs, or when motion is paused/reduced. The original PNG remains the loading/error/JavaScript-disabled fallback.
- `src/lib/pet-animation.ts`: pure breathing, blink, and personality reaction timelines, covered by `npm test`.
- `src/lib/pet-renderer.ts`: render-time eye layers and integer pixel row bands, preserving source artwork. These are website motion studies, not new desktop sprite sheets.
- `src/components/ui/reveal.tsx`: section entrances using Motion, with static content preserved for JavaScript-disabled browsers.
- `src/lib/companions.ts`: companion copy, images, and development status.
- `src/app/page.tsx`: landing page content, navigation, rituals, and release status.
- `src/app/globals.css`: Tailwind import, theme tokens, typography, and responsive layout.
- `src/lib/utils.ts`: standard `cn` helper for class composition.

`components.json` configures the shadcn aliases. Because this app uses `src/`, the UI component folder is `src/components/ui`, imported as `@/components/ui`. Keeping reusable primitives here allows future shadcn components to use the same conventions. TypeScript and Tailwind are already installed; no additional project initialization is needed. Run future shadcn CLI commands from `website/`.

The split-canvas shader renders only on scroll, resize, or relevant preference changes. Images remain visible if JavaScript or WebGL is unavailable, an image fails to load, or the GPU context is lost. Reduced motion switches to a crossfade and disables smooth anchor scrolling. GPU resources and listeners are disposed on unmount.

Artwork in `public/pets/` is copied from the existing project assets. See `public/pets/NOTICE.md` for provenance. No public download is advertised while distribution is pending.

The hero uses the existing Ember artwork and the Moon cat / Moss bunny concepts. Cat and bunny selection is a website preview, and both are marked in development. DM Sans and Pixelify Sans are self-hosted through their Fontsource packages, which include their SIL Open Font License texts.

Every companion has a full-scene pixel-art habitat. Blue Jelly’s tidepool is in `public/habitat/blue-jelly-tidepool.webp`, and the other ten scenes are in `public/habitat/scenes/`. Scenery and the living pet transition as one layer, with outgoing layers inert during the crossfade. The Imagegen prompts and asset provenance are recorded in [`docs/design/website-hero-habitat.md`](../docs/design/website-hero-habitat.md).

`src/components/companion-habitat.tsx` handles the coordinated scene transition. `src/lib/habitat-selection.ts` waits for preloaded images before committing a choice, preserves the current scene if an image fails, supports retry, and ignores stale loads during rapid switching. These cases are covered by `npm test`. Paused/reduced motion switches scenes instantly.

Ambient life is drawn by `src/components/habitat-ambience.tsx`: three fluttering butterflies for Ember, slowly twinkling stars and drifting fireflies for Moon, and six falling leaves for Moss. The decorative Canvas ignores pointer input, is hidden from assistive technology, is capped at 24 fps, and suspends offscreen, in hidden tabs, on outgoing scenes, and when motion is paused or reduced. Pausing preserves the ambient pose.

Hover no longer moves the island or snaps the pet upward. Only opaque pet pixels count as pointer hits, greetings wait for a short dwell, and mouse focus does not leave the hover state stuck on. Keyboard and touch head pats still work. The grid in the hero and download sections follows the cursor with eased lighting and fades out on pointer exit.
