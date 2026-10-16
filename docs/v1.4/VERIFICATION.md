# V1.4 — Companion UI refinement

The existing companion events and appearance preference are retained. Today now places Pomu beside the greeting in a compact welcome area; Tasks also shares its heading row with Pomu. NOW/NEXT no longer sit below a separate companion row. The ivory, peach, sage, and text colours are unchanged.

| Appearance | Desktop | Mobile ≤760px | Narrow mobile ≤380px |
| --- | --- | --- | --- |
| Professional (default) | 80px | 64px | 56px |
| Cozy | 112px | 88px | 72px |

These are image element widths; object-fit preserves the supplied proportions. The mobile welcome puts the greeting beside Pomu and the focus button, without overlap. Welcome speech is suppressed at widths ≤1100px to keep controls clear. Cozy messages remain available where space permits, with the existing 15-second cooldown.

## Reactions

- Task creation: happy bounce, 0.9 seconds.
- Completion: happy jump, 1.2 seconds; Cozy adds two small peach/sage CSS glints and a slightly larger jump.
- Start focus: focused image with a gentle 0.9-second entrance.
- Pause: idle image with a brief tilt, then focused resting image.
- Complete focus: short happy celebration, then focused resting image.
- Enter Shutdown: sleepy image with a gentle 0.9-second entrance; sleepy remains the resting state.

Temporary reactions reset after 1.3 seconds. Rerenders do not touch companion animation state; only actions trigger reactions. While the immersive overlay is open, only its companion reacts. Professional has smaller movement and no speech or extra glints. Reduced motion disables all companion animations and glints. No loops, sounds, notifications, frameworks, or runtime dependencies were added.

## Unresolved release blocker: transparency

**Background removal is not complete.** All four original PNGs have dark backgrounds and no fully transparent pixels. An automated removal attempt returned a combined, upscaled image with visible edge artifacts and changed details; it was rejected rather than replacing Pomu with altered illustrations. None of that output is used in this branch.

The original assets remain byte-for-byte intact in `assets/pomu/`, including faces, outlines, sparkles, laptop, sleeping symbols, soft shading, and proportions. Consequently dark rectangles remain visible on ivory and white. The clean transparent-edge/no-dark-box requirements cannot be marked passed. Approved transparent source exports or a carefully retouched cutout of the original artwork are still needed before release. CSS masking/blending is not used to conceal this issue.

| Asset | Dimensions | Alpha range | Fully transparent pixels |
| --- | --- | --- | --- |
| pomu_idle.png | 155 × 133 | 128–255 | 0 |
| pomu_happy.png | 145 × 154 | 170–255 | 0 |
| pomu_focus.png | 159 × 112 | 170–255 | 0 |
| pomu_sleepy.png | 137 × 133 | 128–255 | 0 |

[Original asset inspection on ivory and white](screenshots/asset-inspection.png). This is evidence of the remaining blocker, not a successful transparency check.

## Verification

118 browser assertions passed in Chromium through Playwright against a local HTTP server. No JavaScript errors. These checks do not include a transparency pass.

- Desktop Professional/Cozy: measured 80/112px, compact welcome, no overlap with greeting or focus button.
- Mobile Professional/Cozy: measured 64/88px at 390px, compact welcome, no overlap.
- Layouts and immersive timer fit 1440, 1024, 768, 390, and 320px widths without horizontal scrolling.
- Active reactions and speech fit both modes at those five widths.
- Images load; create/complete/status-complete reactions and resting-state restoration work.
- Ordinary renderAll preserves the running CSS animation object rather than restarting it.
- Focus countdown, pause, session completion/logging, task completion, and return to Today work.
- Shutdown sleepy transition and saving tomorrow's anchor work.
- Appearance selection survives refresh and does not change task storage.
- Custom category creation, rename, deletion with reassignment, and task retention work.
- JSON export/import preserves custom task/category data and excludes appearance preference.
- Reduced motion disables companion movement and CSS sparkles; existing orb remains still.

Session completion was exercised by setting in-memory seconds to 1 and waiting for the real timer callback, rather than waiting a full 25 minutes. Browser verification tools were not added as app dependencies. Screenshots of the four modes use the default task data; workflow screenshots may contain disposable verification tasks.

## Updated screenshots

| Desktop | Mobile |
| --- | --- |
| [Professional](screenshots/desktop-professional.png) | [Professional](screenshots/mobile-professional.png) |
| [Cozy](screenshots/desktop-cozy.png) | [Cozy](screenshots/mobile-cozy.png) |

- [Cozy immersive focus](screenshots/desktop-focus-cozy.png)
- [Mobile immersive focus](screenshots/mobile-focus-overlay.png)
- [Shutdown](screenshots/desktop-shutdown.png)
- [Appearance selector](screenshots/mobile-settings.png)

## Data and rollback

The existing `kikiFocusOS` structure, `pomuAppearance` preference key, task/category code, JSON backup format, and timer accounting remain unchanged by this refinement. No migration is needed. Revert this refinement commit to restore the earlier placement and animation styling.
