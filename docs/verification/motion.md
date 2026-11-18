# Ember fox motion follow-up

[PR #7](https://github.com/RithyBondeth/Bondex-Buddy/pull/7) merged the artwork and native fixture into `develop` as `ade6a7866f8333ac75c1f8415fa4667fa9371a6b` after macOS Intel and Windows CI passed. The `bondeth/fox-motion-loops` follow-up adds the motion studies below.

## Motion behavior

| Mood     | Motion                                              | Timing                                     |
| -------- | --------------------------------------------------- | ------------------------------------------ |
| Idle     | One-pixel inhale with feet anchored to the shelf    | 4-second loop                              |
| Working  | Grounded breathing, then a one-pixel reading nod    | 4.2-second loop                            |
| Sleeping | Slow breathing through the curled/blanket pose      | 5.2-second loop                            |
| TeaBreak | One-pixel cup/paw lift with the lower body grounded | 4.4-second loop                            |
| Happy    | Two small hop peaks, then a resting smile           | One 2-second greeting; no endless bouncing |

The renderer uses integer row bands from the existing sampled illustrations. It does not modify source PNGs or add smoothing. Calm poses preserve the feet baseline while stretching/compressing body rows by one pixel. Beanie/scarf anchors follow the deformation. These are runtime motion studies awaiting visual approval, rather than newly hand-authored sprite sheets. Distinct poses retain cached binary masks; decorative particles remain outside those masks.

Every accepted greeting resets the motion's elapsed time, including another greeting during Happy. Petting during a running focus session remains rejected by the engine and does not reset the Working motion. Reduced motion uses the same neutral frame at all elapsed times, with no floating particles or continuous RAF loop. Existing hidden-window suspension and 30 fps scheduling remain in effect.

## Review page

Run `npm run dev` and open `http://127.0.0.1:1420/motion-review.html` (or the port printed by Vite). The review page shows all five moods at the application's 2× pixel scale. Pause/resume, restart, scrub time with the range control, toggle reduced motion/evening tint, and preview every outfit/decor option. These controls never load, award, or save progress and do not invoke native commands. Happy settles after two seconds; use Restart to replay its hop.

Startup performs 165 review-only renderer assertions: binary mask dimensions, agreement between static masks and alpha pixels, coverage of every keyframe and cosmetic combination at neutral pose, cache identity within a held pose, and reduced-motion neutrality. Pixel readback for these assertions only exists in the review harness; normal production drawing reads pixels when caching a new pose.

## Verified and remaining

- 33 TypeScript tests pass, including timeline boundary/wrap behavior, Happy settling, reduced-motion neutrality, invalid/backward elapsed times, contiguous integer deformation bands, grounded feet, and wardrobe anchors. Existing focus-priority tests also check whether interaction was accepted.
- Browser review reports all 165 renderer assertions passed. Pause remained frozen while changing controls; scrubbing to 100 ms displayed Happy's `hop-high`, and reduced motion changed it to `rest`. Resume advanced elapsed time. Beanie/plant and scarf/lantern previews rendered correctly; Sleeping continued to hide the outfit.
- Frontend checking, lint, formatting, and production build pass. The normal macOS debug bundle is rebuilt for this frontend change.

Final aesthetic approval, subjective sound review, native mouse/animation acceptance on macOS and Windows, mixed-DPI hardware, full process profiling, OS login testing, signing, and installer validation remain open. Browser assertions and the existing geometry unit tests do not establish native click-through acceptance. See [native status](artwork-native.md) and [release preparation](../release.md).
