# Cyber Casino Hack implementation and graphics verification
Date: 2026-10-08

For the latest responsive layout, annotated screenshot fixes, guided training, chapter themes and piece collections, see the [responsive and experience verification report](<./responsive-experience-verification.md>). The results below record the earlier graphics-restoration phase.

The graphics regressions are corrected and the expanded game is verified. The original visual style is restored, every graphics preset retains the full scene, and the menu and settings fixes are complete.

## Graphics corrections compared with the previous source

The earlier scene components and effect helpers were retained. The enhancement refactor introduced three presentation regressions: a bright cyan backing exposed thick cell dividers, lower graphics presets excluded decorative scene components, and deterministic engine frames no longer drove the original action effects. The corrections restore the earlier presentation while keeping the expanded gameplay.

- Restored the dark reflective backboard, original cyan/magenta lighting, token meshes/materials, and bold glowing perimeter. Interior grid lines are faint dark lines, 0.01 scene units wide, versus the 0.08-unit outer frame.
- Every quality preset renders the city, hacker, sentinel drone, holograms, floor, and board. Presets control pixel density, antialiasing, and particle budgets. Adaptive density reduces resolution under sustained slow rendering.
- Restored token-specific sparks, fireworks, splashes and shards; expanding blast rings; animated lasers/lightning; special-creation effects; floating cascade scores; hacker reactions; camera shake; and staged swap, clear and refill animations.
- Reconnected sound feedback for selections, swaps, invalid moves, matches, landing/refills, special creation, laser/EMP/overload operations, shield damage and boss lockdowns. Reduced motion intentionally suppresses flashes, decorative movement and large bursts.
- Removed the token-symbol toggle and ordinary token overlays. Old saved symbol preferences are ignored. Essential hazard health, packet and vault badges remain.
- Added an always-visible top-right settings X outside the scrolling content. It closes without Cancel/Save; preferences already save automatically.
- Replaced the black start-screen background with the animated neon city and a CSS background fallback. The menu is a full-screen main page, including after returning from a heist.

## Completed game enhancements

Five mission types (score, named token collection, hazards, delivered packets and vault damage); chainable special combinations; three interactive training lessons; idle/manual hints; predictable boss lockdowns; six campaign districts with 60 nodes and bounded endless difficulty; replayable mastery stars and first-completion-only loot; deterministic UTC daily challenges with isolated inventory and local best scores; unlockable cosmetic palettes and achievements; keyboard/touch controls; reduced motion; graphics presets; validated settled saves; pause/cancellation; and daily action-receipt validation.

The daily best is local to this browser. The replay validator is a foundation for server-side verification; an online leaderboard/service was not created.

The standalone setup includes a pinned package manifest and dependency lockfile, Vite/TypeScript/Tailwind build configuration, unit/application tests, Playwright desktop/touch tests, and a reproducible balance simulation script.

## Verification

- Clean `npm ci`: passed (188 packages installed; zero reported vulnerabilities).
- `npm run build`: passed, including TypeScript checking.
- `npm test`: 73 tests passed across 7 files.
- Browser checks: 40 distinct cases passed across desktop Chromium and Pixel 7 touch emulation. The complete run passed 38; two new quality tests initially used the wrong settings-button name. After correcting that test selector, both passed on targeted rerun.
- Browser coverage includes all five mission types, tutorial completion, special fusion, daily isolation, cosmetic scene rendering, all three quality presets retaining actual scene objects, settings X after scrolling, menu background on entry/return, synthesized EMP audio and explosion particles/shockwaves, real pointer/touch swaps, save/reload, pause, restart cancellation, corrupt storage, reward protection, purge consumption and loss.
- `npm audit --omit=dev`: zero reported vulnerabilities.
- Balance: 2,400 seeded boards across 12 representative levels. Packet missions gained four extra moves after the initial 2,000-board baseline. Final bot completion rates for packet nodes 4 and 44 were 76.5% and 70%. These are deterministic bot measurements, not human difficulty estimates.
- Visually inspected restored desktop board/menu screenshots and quality-preset screenshots.

## Remaining limits

Vite reports the Three.js game chunk above 500 kB (about 872 kB minified / 229 kB gzip). The scene remains lazy-loaded; the restored menu also loads it for its city background. The installation reports a deprecated transitive `three-mesh-bvh` version, with no audit vulnerability reported. Browser tests use software WebGL and an emulated phone viewport; physical-device frame rate and audible external music playback were not measured. External music requests were blocked during browser tests.

## Evidence

- [Restored board](<./board-restored.png>)
- [Restored menu](<./main-menu-restored.png>)
- [Final balance results](<./balance.json>)
- [Initial balance baseline](<./balance-baseline.json>)
- [Usage and verification commands](<../README.md>)
