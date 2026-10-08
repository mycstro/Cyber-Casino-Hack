# Cyber Casino Hack responsive and experience verification

Date: 2026-10-08. This report extends the earlier [graphics verification](<./verification.md>). The latest work keeps the original scene and effects while correcting the annotated screenshot, adapting the layout and renderer, and adding guided training, chapter experiences and collectible pieces.

## Screenshot review and previous-version comparison

The two glaring tiles in the supplied screenshot were hint/selection highlights, amplified by a point light of intensity 40 on each highlighted tile. Those lights are removed. Selection now uses a subdued dark backing, a thin cyan outline, a small lift and a 4% scale increase. Hints clear on input and expire after six seconds. The bold outside frame remains; interior board dividers stay faint at 0.01 scene units.

The yellow object was a cipher lock with one shield health. Its body and glow are now darker amber, its badge reads **LOCK 1**, and selecting a hazard explains its name and how to break it. The active-hazard counter follows the actual remaining board hazards, including after purge, instead of the original level plan.

The original token meshes remain the default. The city, hacker, drone, holograms, floor, staged swap/clear/refill effects, special auras and action sounds remain present on every graphics preset. Ordinary token-symbol overlays and their toggle remain removed. The settings X remains accessible while its contents scroll. The main menu remains a full-screen page with a scene background on entry and return.

## Responsive behaviour and rendering

The shell uses dynamic viewport height and device safe areas. The HUD, five booster actions, menus and settings adapt to screen width and height. Camera framing uses the available board area and refits after live resizing or rotation. Mouse parallax does not follow touch taps. Long hacker feedback wraps within a bounded speech bubble.

Graphics presets vary curved geometry detail, billboard resolution/update frequency, framebuffer density, antialiasing and particle budgets. Pixel budgets limit large-screen allocation. The scheduler targets 30/45/60 frames per second and preserves the average cadence on 60, 120 and 144 Hz refreshes; sustained slow rendering lowers its budget and sustained recovery raises it. These are scheduling targets, not measured device frame rates.

Hidden pages pause gameplay and scene rendering. Menus pause in-flight moves safely. If WebGL 2 is unavailable or its context is lost, a DOM board preserves the same engine, all 64 tiles, clicks/taps, effects, selected collection and progress. Retry 3D visuals occupies its own row, cannot cover a tile, and remounts only the rendering surface.

## Learning and rewards

Training gives each lesson a specific goal, outlines its practice pair, and changes from “select the diamond” to “select the chip above it” after the first selection. Instructions cover tapping, dragging and keyboard input. Incorrect practice swaps do not spend moves. Completion explains three-piece matches and gravity, two-line Cross Laser creation and activation, or adjacent shield damage. The second lesson is updated to the latest match rules. Training retains the original pieces so its color and shape names agree with the board.

Every completed campaign run now grants booster loot, including replays. An earlier first-clear restriction suppressed replay rewards; it is removed. A run guard prevents repeated completion callbacks, and victory writes the next-level checkpoint. The completion card focuses its container rather than scrolling directly to Advance, shows the loot panel, wraps labels, and scrolls within small screens. Boss loot includes all five booster types.

Every tenth campaign completion adds a free three-reel slot round after normal loot. A spin always matches a booster; power 1–5 grants quantity 5–1 respectively: +5 Moves ×5, EMP ×4, Cross Laser ×3, Purge ×2, Overload ×1. Purge ranks fourth because it now clears all hazards. Outcome persistence prevents rerolling on reload. A write-ahead payment receipt prevents a repeated payout and recovers interrupted inventory writes. Reloading during a spin shows the already-paid result; Continue opens the next campaign level. Replaying a tenth node earns another spin for that completed run.

Campaign XP is separate from match score. Base XP is 100 plus 25 per difficulty tier above the first and 50 for a security core. Booster-free clears multiply that by 1.25 plus 0.10 per additional tier, 0.25 on cores, and up to 0.75 for move efficiency. Efficiency measures the original move budget left after moves taken, clamped to 0–1. Any consumed inventory booster removes the multiplier, including +5 Moves. Natural board specials do not count as inventory boosters. Completion shows the calculation and career total; the hub shows rank and XP to its next 1,000-XP threshold. Reload retains move/booster counters and awarded XP. Daily and training rewards stay isolated.

Overload now triggers every active board laser, bomb and core regardless of distance or color, including when reached by another chain. Specials fire once per chain, existing bombs retain their effect during laser conversion, and toolbar inventory remains untouched. Purge removes all board hazards, reinforced shield layers, boss locks and vaults; vault objectives receive full credit. It preserves packets, spends no move and rejects an empty-board use without consuming a booster.

The latest requested recipes replace the earlier four-piece laser, five-piece Overload and T/L EMP recipes. Overload, EMP and Purge now remain reward-only. Exactly two simultaneous matched lines, including T/Ls, create one Cross Laser on the board. Earned and rewarded Cross Lasers clear two distinct rows and two distinct columns, including at corners. Three or more matched lines cleared by one swap across its cascades grant five moves once, with feedback and resume persistence. Blast-cleared rows/columns do not earn that match bonus. These earned effects do not consume inventory and retain booster-free XP eligibility. Old saved special pieces remain usable. Ordinary completion reward quantities remain one or two per booster type, alongside the requested milestone-slot paytable.

Collections depend on distinct completed campaign nodes. A replay can improve stars but cannot grant a collection again. A new set appears on victory with an Equip button; all earned sets can also be equipped in the hub’s Cosmetics section. Old careers migrate to the original set, and unknown/unearned selections are rejected. Sets retain color identities and gameplay rules, with different 3D geometry and corresponding DOM shapes.

| Collection | Requirement |
| --- | --- |
| Casino Originals | Available immediately |
| Prismatic Gems | 5 different campaign nodes breached |
| Arcade Blocks | 10 different campaign nodes breached |
| Orbital Relics | 20 different campaign nodes breached |

## Ten-level chapters

The background changes immediately when levels 10, 20, 30 and each subsequent tenth campaign node are completed; the victory screen already shows the next environment. Previously the scenes reused the same skyline, and victory could pause rendering before the replacement drew. Distinct structures now replace that skyline, and a chapter change explicitly schedules a redraw even while paused. The six experiences cycle through the endless frontier, so level 61 begins the next cycle. Each chapter changes sky colors, structures, animation geometry/movement, pitch, waveform and impact-filter profiles, including laser synthesis. The next-level checkpoint retains its background after reload. Mute and volume preferences stay independent.

| Levels in first cycle | Chapter | Animated motif |
| --- | --- | --- |
| 1–10 | Neon District | Skyscrapers and passing traffic |
| 11–20 | Quantum Vaults | Floating vaults and orbital rings |
| 21–30 | Black Lotus | Lotus gardens and drifting petals |
| 31–40 | AI Central | Server stacks and falling data streams |
| 41–50 | Singularity | Asteroids and rotating vortex |
| 51–60 | Matrix Horizons | Floating islands and aurora lines |

## Verification

- Production build and TypeScript checking passed. Initial application chunk: 251.77 kB minified / 78.55 kB gzip; lazy scene chunk: 887.18 kB / 233.70 kB gzip.
- Unit/application suite: **125 tests passed across 13 files**. Coverage includes deterministic engine/resume, board recovery, replay loot, milestone slots, interrupted payment recovery (including a temporarily failed recovery), XP calculation and resume, all-special overload chains, full-board purge, reward-only recipes, two-line Cross Laser creation and edge blasts, once-per-move +5 combos, daily isolation, pause/cancellation, save validation, camera fitting, live hazard counts, refresh-rate cadence, chapter boundaries and collection migration. Overload injection rejects protected objective tiles rather than silently deleting an objective.
- Final production-build browser suite: **110 tests passed, zero failures, in 22.8 minutes across 12 projects**. The complete desktop/mobile gameplay suites and every responsive/browser project ran against the final build, including the clarified reward-only recipes and corrected Purge fixture.
- `npm audit --omit=dev`: **zero reported vulnerabilities**. No new dependencies were required.
- Prior clean `npm ci` passed; the pinned manifest and lockfile remain in place. A fresh **2,400-board balance run passed** with the final Cross Laser and earned-move rules, without dead boards or position-count failures. Completion ranged from 99.5–100% on its 12 sampled nodes. Earned moves often left a reserve above the original level budget, so these rules are more generous than the earlier rules. The simulation uses one EMP when needed; it does not assess the complete inventory/slot economy or measured human difficulty. See [the rules-version-3 simulation](<./balance.json>).

The browser matrix includes Chromium desktop and Pixel 7 touch emulation, 320×568 and landscape phones, portrait/landscape tablets, laptops, ultrawide, 4K, Firefox, WebKit phone emulation and installed Edge. Responsive checks measure actual control bounds and camera-projected board corners, rotate the viewport, scroll settings, and perform native clicks/taps on the DOM fallback. Slot checks run across the entire matrix, including keyboard focus containment, no horizontal clipping, scrolling, native clicks/taps and paid-reward reload. Desktop/Pixel tests additionally cover all lessons, six actual rendered environments and frontier cycling, first-time piece rewards/equipping/reload, all collection shapes and graphics qualities, earned Cross Laser rendering/firing, earned +5 moves, XP eligibility, GPU loss/retry and hidden-page suspension.

Early new checks had test-assumption errors: a click uses sine in both the original and Quantum profiles, so sound assertions capture scheduled frequencies and verify changed pitch; the training feedback selector was narrowed because the same explanation also appears in the hacker speech bubble. An older Purge test expected consumption on a clean board; it now supplies a shield, while separate tests verify that a clean-board use preserves inventory. A combo fixture had a pre-existing edge match; it is corrected so the tested swap actually creates the requested lines. The final suite uses these corrected checks. Test workers are capped to avoid process-startup exhaustion on Windows.

## Evidence and limits

Saved screenshots include the [earned Cross Laser](<./match-cross-desktop.png>), [guided training](<./training-desktop.png>), [level-20 loot and new Lotus environment](<./completed-20-desktop.png>), [mobile XP breakdown](<./xp-clean-mobile.png>) and [mobile slot reward](<./bonus-won-mobile.png>).

The scene still triggers Vite’s warning for a chunk over 500 kB. Software WebGL, emulated touch viewports and WebKit engine testing do not establish physical-phone/tablet frame rates or native Safari performance. Modern browser engines are tested; legacy browsers lacking the required JavaScript/CSS features remain outside support. Synthesized oscillator starts and chapter pitch changes are checked, but audible external music playback is not measured; external music requests are blocked during browser tests.

Campaign collections, saves and daily bests remain local to the browser. Clearing browser storage removes that local progress. The existing daily replay validator remains a foundation for a server-backed leaderboard; no online ranking service was added.
