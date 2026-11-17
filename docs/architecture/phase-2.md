# Phase 2 behavior and architecture

## Engine boundaries

`SpiritEngine` is independent of the UI and native APIs. Application wiring supplies the current timestamp, local minutes of day, and idle samples. Snapshots expose the mood, timer phase/status/remaining duration, session completion count, and activity availability. Session state is in memory only; persistence and unlocks belong to Phase 4.

## Mood rules

Priority is evaluated on each update:

1. A running manual focus session is Working, including at night, while idle, and when petted.
2. A direct interaction temporarily shows Happy for two seconds, then re-evaluates current conditions. It never pauses or resets a timer.
3. An active or paused break session is TeaBreak.
4. Sleeping applies after five minutes of OS idle time or from 23:30 through 05:59 local time. A paused focus does not override sleep.
5. Returning to recent input after an observed idle duration longer than ten minutes gives a 30-second TeaBreak.
6. Sustained recent input for more than 15 seconds gives Working. Recent means the last system input was less than five seconds ago at each sample. This approximates activity cadence; it does not measure typing speed or inspect keys.
7. Otherwise the mood is Idle.

The temporary renderer has different static poses/cues for all five states. Smooth sprite animation and sound are not included in Phase 2.

## Focus clock

- Start creates a 25-minute focus session.
- Pause freezes the remaining duration; Resume establishes a new deadline from that remainder.
- Reset cancels the current focus or break. It does not award a partly completed focus session.
- A completed focus awards one in-memory completion and starts a five-minute break.
- A completed break returns to idle; it does not automatically start another focus session.
- Deadlines use injected wall-clock timestamps rather than decrementing once per callback. Delayed callbacks and sleep/resume reconcile against the deadline. If both focus and break elapsed while suspended, the engine awards one focus completion and returns to idle.
- Backward wall-clock adjustments do not increase remaining time. Forward adjustments count as elapsed time; manual clock changes need native acceptance testing. Time zone/daylight changes affect local night behavior independently of the timestamp deadline.

## Activity observer

Rust polls every five seconds even while the window is hidden. macOS uses CoreGraphics `CGEventSourceSecondsSinceLastEventType` with combined session state and any input event. Windows uses `GetLastInputInfo` and wrapping tick subtraction for the current user session. Neither implementation hooks input, records key contents, or captures screens.

Sources: [Apple idle-time API](<https://developer.apple.com/documentation/coregraphics/cgeventsource/secondssincelasteventtype(_:eventtype:)>), [Microsoft GetLastInputInfo](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getlastinputinfo).

The payload contains only `idleSeconds` (or null if unavailable) and `sampledAtMs`. The engine ignores out-of-order samples and samples older than 15 seconds, clears stale activity, and continues to support the manual timer. Returning from away requires a previously observed long idle sample; it is not inferred from a gap alone. Browser previews explicitly have no OS activity source.

## Hover and click-through

Native hit testing emits a `habitat-hover` event based on proximity to the entire 220 × 200 window, including transparent areas. This lets the controls stay visible while moving through the transparent gap above the pet. It does not make the gap intercept clicks.

The opaque control rectangle is x=6..214 and y=10..42 in logical window coordinates and must match `.controls` in CSS. Only that rectangle is added to the native hit region while controls are visible. DOM hover is used for browser previews; native proximity is authoritative in the desktop app. Keyboard focus also reveals controls while the document is focused.

Mood redraws upload a fresh Canvas alpha mask through `update_shell_mask`, which never calls show. Consequently a mood transition cannot re-open a window hidden through the tray. Updates are serialized in the frontend. Listeners and the one-second UI clock are cleaned up on unload/HMR. Canvas redraws happen on mood changes, not on every clock tick.
