# V1.4 — Interactive Pomu Companion

Professional is the default (64px artwork, finite action reactions). Data → Pomu appearance switches to Cozy (84px, expressive celebration, short speech bubbles with a 15-second cooldown). The new `pomuAppearance` localStorage key is separate from `kikiFocusOS`; task/category data and JSON backup format are unchanged.

Today and Tasks rest on idle; Focus and the immersive timer rest on focused; Shutdown rests on sleepy. Reactions last 1.6 seconds, then restore the relevant resting image. Navigation cancels temporary reactions. CSS animations run once and are disabled under prefers-reduced-motion. No dependencies, sound, notification, or replacement illustrations were added. Removed the existing timer completion vibration. Initial rendering now waits for DOMContentLoaded so timer overlay controls exist at startup.

## Release issue: supplied artwork has dark backgrounds

All four original PNG byte streams are preserved exactly under `assets/pomu/`. They are RGBA but are **not transparent cutouts**: no pixel has alpha 0, and over 98% of pixels in each image are fully opaque. Their dark rectangular backgrounds remain visible in the light UI. No background removal, masking, blending, or replacement artwork was applied. Obtain approved transparent exports before release.

| Asset | Dimensions | Alpha range | Fully transparent pixels |
| --- | --- | --- | --- |
| pomu_idle.png | 155 × 133 | 128–255 | 0 |
| pomu_happy.png | 145 × 154 | 170–255 | 0 |
| pomu_focus.png | 159 × 112 | 170–255 | 0 |
| pomu_sleepy.png | 137 × 133 | 128–255 | 0 |

## Verification

Automated Chromium checks via Playwright against a local HTTP server; no browser JavaScript errors. Browser tooling was used only for verification, not added to the app. Completion was exercised by setting the timer's in-memory remaining seconds to 1, then waiting for its real interval callback (a full 25-minute wall-clock session was not run). Screenshots contain disposable verification data.

- Passed: Default professional mode
- Passed: Image loads: idle
- Passed: Image loads: happy
- Passed: Image loads: focus
- Passed: Image loads: sleepy
- Passed: Task creation happy reaction
- Passed: Temporary reaction returns to idle
- Passed: Task completion celebration
- Passed: Status completion celebration
- Passed: Appearance leaves task storage unchanged
- Passed: Cozy survives refresh
- Passed: Custom category creation
- Passed: Task retains custom category
- Passed: Focus start reaction
- Passed: Timer counts down
- Passed: Pause stops timer
- Passed: Focus pause reaction
- Passed: Pause returns to focus resting image
- Passed: Focus completion happy reaction and logged minutes
- Passed: Focus completion returns to resting state
- Passed: Shutdown sleepy Pomu
- Passed: Shutdown anchor saved
- Passed: JSON roundtrip retains custom tasks/categories
- Passed: Reduced motion disables companion animation
- Passed: Reduced motion keeps orb still
- Passed: No horizontal overflow: 1440px today
- Passed: No horizontal overflow: 1440px tasks
- Passed: No horizontal overflow: 1440px focus
- Passed: No horizontal overflow: 1440px shutdown
- Passed: No horizontal overflow: 1440px settings
- Passed: Focus overlay fits: 1440px
- Passed: No horizontal overflow: 390px today
- Passed: No horizontal overflow: 390px tasks
- Passed: No horizontal overflow: 390px focus
- Passed: No horizontal overflow: 390px shutdown
- Passed: No horizontal overflow: 390px settings
- Passed: Focus overlay fits: 390px
- Passed: No horizontal overflow: 320px today
- Passed: No horizontal overflow: 320px tasks
- Passed: No horizontal overflow: 320px focus
- Passed: No horizontal overflow: 320px shutdown
- Passed: No horizontal overflow: 320px settings
- Passed: Focus overlay fits: 320px
- Passed: No browser JavaScript errors

- Passed: Cozy speech bubble
- Passed: Switch back to Professional
- Passed: Complete focus task returns to Today with celebration

## Screenshots

- [Desktop Today — Professional](screenshots/desktop-today.png)
- [Desktop focus — Cozy](screenshots/desktop-focus-cozy.png)
- [Desktop shutdown](screenshots/desktop-shutdown.png)
- [Mobile Today — Cozy](screenshots/mobile-today.png)
- [Mobile Focus](screenshots/mobile-focus.png)
- [Mobile immersive timer](screenshots/mobile-focus-overlay.png)
- [Mobile Tasks](screenshots/mobile-tasks.png)
- [Mobile Shutdown](screenshots/mobile-shutdown.png)
- [Mobile appearance selector](screenshots/mobile-settings.png)

Rollback: revert this change; existing task storage and backups need no migration. The independent appearance key can remain harmlessly in localStorage.
