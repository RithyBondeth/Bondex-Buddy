# Phase 4 first slice

Phase 3 was published and merged into develop through PR #3, after macOS and Windows CI passed. Its remaining final-art, dragging/snapping, Ghost Mode, and profiling tasks remain open. This Phase 4 slice adds local progression and preferences; the remaining items are listed below.

## Progress and rewards

Completed focus sessions earn permanent cosmetic access: one session unlocks a plant; three unlock a lantern. Resetting a partial session earns nothing. The UI adds only the new completion delta from the engine, so repeated ticks do not duplicate rewards. There are no streaks, penalties, timestamps, or away-history records.

The Items drawer contains the completion total, a decor picker with locked options disabled, and a lighting picker. Bare desk is always available. These are provisional pixel props alongside the existing test pet; outfits/hats and approved final assets remain open.

Automatic lighting adds a warm alpha-preserving tint from 18:00 through 05:59 local time. Daylight overrides the tint. Color changes do not expand the native hit mask; decor geometry does. The opaque drawer is x=6..214, y=46..116 in logical window coordinates; it is included in native hit testing only while visible.

## Local saves

Version 1 stores only `completedFocusSessions`, `decor`, and `lighting`, plus the schema version. Active timers, input contents, activity samples, audio opt-in, and window placement are not stored. Sound still starts muted.

Native commands read/write `progress.json` inside Tauri's app-data directory. The frontend never supplies a path. Reads are bounded to 64 KiB, and writes validate JSON/version, flush a temporary file in the same directory, then replace the destination with `std::fs::rename`. Requests are serialized within the running process. This is intended for one active app instance; concurrent instances and full power-loss durability are not guaranteed.

Source: [Rust rename behavior](https://doc.rust-lang.org/std/fs/fn.rename.html).

Browser previews use a separate localStorage key, `tiny-desk-spirit.preview.progress.v1`. Preview and native progress are intentionally separate.

The frontend strictly validates the schema, ignores unrelated fields, and removes locked equipment without discarding a valid completion total. Corrupt or unsupported saves are preserved and put the session into an in-memory fallback. A drawer message reports save trouble. Failed writes can be retried on the next change without poisoning later requests. Native writes also refuse to overwrite corrupt/unsupported-version files.

## Verification

- 23 TypeScript tests pass, including cancellation/unlock integration, schema round-trips, locked-item handling, unsupported-save preservation, write ordering, and retry behavior.
- Four native tests pass, including repeated on-disk replacement and preserving invalid/future data. Rust formatting and Clippy pass locally.
- Frontend checks/build and debug macOS packaging pass.
- Browser Items drawer shows both cosmetics locked at zero sessions and restores the Daylight selection after reload.
- Native macOS Items drawer opens successfully and restores Daylight after quitting and reopening the app.

## Still required

- Complete a real focus session, equip the newly unlocked decor, restart, and verify the count/item on both platforms.
- Check the drawer hit region and scaled click-through on native macOS/Windows.
- Verify actual clock-boundary lighting changes and reduced-motion behavior.
- Add wardrobe/outfits, approved art, and an explicit launch-at-login preference.
- Exercise disk errors, future save versions, and user-facing recovery on native machines.
