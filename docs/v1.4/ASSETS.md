# Pomu transparent asset verification

The supplied white-background replacements were found in commit [`9c50f36`](https://github.com/koonkee-beep/pomu-pomu-focus-os/commit/9c50f369ee328f5bf850e45d0d4a0e8660cab4d5), under `docs/assets/pomu_*.png` on main. The V1.4 branch still contained the older dark-background artwork. The processed replacements are now installed at the existing `assets/pomu/pomu_*.png` application paths.

## Result

All four files now contain genuine zero-alpha background pixels, fully opaque character interiors, and partially transparent anti-aliased edges. Dimensions and proportions match the supplied replacement images exactly. There was no redraw, rescaling, generative replacement, global white-pixel key, CSS masking, or blending workaround.

White and cream fur, expressions, brown outlines, tail, laptop and logo, gold decorations, and sleeping symbols were inspected on all three backgrounds. Source pixels outside the exterior background and its two-pixel boundary band remain exactly unchanged. Native artwork is small; 3× previews enlarge the source's existing raster softness and are not higher-resolution redraws.

## Preparation

1. Inspect each source PNG and its alpha channel. None had fully transparent pixels; all retained white backgrounds.
2. Flood-fill only near-white pixels connected to the canvas border (all RGB channels at least 248). Enclosed white fur and ear highlights are not part of that exterior fill.
3. Refine coverage only in the two-pixel band immediately inside the exterior. For a pixel whose colour fits a white-matted mixture of nearby solid outline/decorative colour, estimate alpha and remove the white contribution from RGB. Unsupported colour fits remain unchanged. This avoids simply making all light pixels transparent.
4. Verify the remaining interior pixels are byte-identical, confirm unchanged dimensions, and compare both versions composited over white. Mean channel difference is below 0.08 on the 0–255 scale for every asset; maximum difference is 7, concentrated in the nearly white removed background/edge rounding.
5. Review enlarged browser composites on warm ivory `#FAF8F4`, white `#FFFFFF`, and dark charcoal `#34312F`. The rectangular backgrounds are gone; the character details and light fur remain intact.

The segmentation and PNG preparation used existing development tooling only. No app dependency, build step, or runtime asset-processing code was introduced. Original uploaded sources remain untouched on main.

## Alpha and preservation checks

| Asset | Dimensions | Fully transparent pixels | Partial-alpha edge pixels | Fully opaque pixels | Interior changes outside edge band |
| --- | --- | --- | --- | --- | --- |
| pomu_idle.png | 181 × 147 | 9,790 | 977 | 15,840 | 0 |
| pomu_happy.png | 166 × 175 | 11,772 | 1,272 | 16,006 | 0 |
| pomu_focus.png | 206 × 137 | 11,245 | 901 | 16,076 | 0 |
| pomu_sleepy.png | 173 × 159 | 14,271 | 986 | 12,250 | 0 |

## Enlarged previews

Each 3× preview shows the same character on ivory, white, and charcoal side by side. The review images use browser compositing, without changing the PNGs.

- [Idle — all three backgrounds at 3×](screenshots/transparent-idle-3-backgrounds.png)
- [Happy — all three backgrounds at 3×](screenshots/transparent-happy-3-backgrounds.png)
- [Focus — all three backgrounds at 3×](screenshots/transparent-focus-3-backgrounds.png)
- [Sleepy — all three backgrounds at 3×](screenshots/transparent-sleepy-3-backgrounds.png)
- [All four characters — twelve composites at 2×](screenshots/asset-inspection.png)

## Application verification

74 Chromium assertions passed with the processed images installed, including all four image loads, task create/complete reactions, focus start/pause/completion, Shutdown, mode selection/persistence, reduced motion, no animation restart on ordinary rerender, custom-category tasks, and JSON export/import compatibility. Desktop and mobile layouts were checked at 1440, 1024, 768, 390, and 320px.

`index.html` is byte-identical to the previous V1.4 commit: animations, event handlers, timer behaviour, appearance settings, storage keys, and task/category code are unchanged. The timer completion check used one remaining second and its real interval callback. Updated app screenshots in the general verification report show the new transparent assets.
