# Cyber Casino Hack

A single-player React/Three.js match-three game. The source export is now a standalone Vite project.

## Run locally

Use Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. Standalone mode runs without loading the external Playground SDK. An embedded Playground host can still provide its SDK.

## Build and verify

```sh
npm run build
npm test
npx playwright install chromium firefox webkit
npm run test:e2e
```

`npm run check` runs the production build, unit/application tests, and browser tests in sequence. `npm run preview` serves the built `dist/` directory locally. Browser tests require a completed build and run against that production output.

Dependencies are pinned in `package.json`; `package-lock.json` records their exact transitive versions and integrity hashes. Use `npm ci` for reproducible installs.

The browser suite runs desktop Chromium and a Pixel 7 viewport with touch input and software WebGL. Set `PLAYWRIGHT_CHANNEL=msedge` or `chrome` to use an installed browser instead of downloaded Chromium. If a corporate certificate is required for browser downloads, configure Node's trusted CA settings; do not disable certificate validation.

## Regression coverage

- Matching at grid edges, locked tiles, two-line Cross Laser creation, intersecting T/L matches, independent matches and once-per-move +5 bonuses.
- Playable recovery across 6, 8, and 10-cell grids, seeded randomized runs, and a guaranteed fallback when random generation fails.
- Cancellation of pending gameplay work after restart and pause/resume of animation waits.
- Save validation, legacy completed-save migration, next-level checkpoints, inventory validation, and duplicate reward prevention.
- Application menu/settings pause state, busy booster restrictions, accepted booster consumption, and level retries.
- Real browser board interaction, mouse/touch swaps, cascades, pause/resume, restarts, completion/reload, purge activation, loss, and corrupted storage.
- Camera framing in portrait and landscape viewports.

Browser tests block external music downloads. Most tests mute audio; a dedicated feedback test instruments synthesized sound playback and checks explosion particles and shockwaves. They verify the standalone game; a live Playground host and audible music playback require separate integration checks.

## Gameplay changes

`game/board.ts` contains pure match detection and deadlock recovery. Every straight matched run counts as one line. Exactly two simultaneously matched lines create one Cross Laser, including T/L intersections and separate lines. Single lines of three, four, five or more pieces do not craft a booster. Overload Core, EMP Blast and Purge Hazard are reward-only boosters. A swap clearing three or more matched lines across its cascades adds **five moves once**; blast-cleared rows/columns do not count as matched lines. Earned board pieces and earned extra moves do not spend toolbar inventory or disqualify booster-free XP.

`game/run.ts` owns asynchronous gameplay waits. Menus suspend elapsed gameplay time, and unmounting cancels pending waits before they can mutate the next run's score.

Completion writes a checkpoint for the next level, including the move bonus, before another level can start. Completed legacy snapshots advance without replaying rewards. Only complete, settled, validated boards can be restored.

Booster inventory is deducted when the board accepts a targeted operation. Busy boards disable the booster tray. Save-and-quit is disabled during an unfinished move; resume to let the move settle, or retry to cancel it.

## Assets and notices

See `THIRD_PARTY_NOTICES.md` for asset notices. Music remains hosted at the original external URLs. `project-files.zip` is the original source export and is retained unchanged; it does not contain the updated build or fixes.

Build-tool reference: [Vite documentation](https://vite.dev/guide/), [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite).

## Expanded heists

Open **Campaign Map & Daily Heist** from the start screen. Six named districts contain 60 campaign nodes; the frontier continues with bounded difficulty after node 60. Missions rotate between score, a named token color, all initial hazards, two data packets delivered to the bottom, and a vault damaged by adjacent matches. Barriers stay anchored during gravity. Packet tokens cannot be destroyed by matches or blasts.

Boss nodes telegraph the row that will be locked every fourth move. Old boss locks expire on the next lockdown. Match beside locks to break them; the central vault is the weak point. The mission strip shows the objective count, next boss action, and tutorial instructions.

Select a special token, then an adjacent special to combine them. Tap the same special twice to fire it alone. Match-earned and rewarded Cross Lasers clear **two rows and two columns**; at an edge, the second line points inward so the blast always covers two distinct lines per direction. Older saved single-line lasers and bombs remain usable. Laser + bomb clears three rows and three columns; overload + laser converts ordinary tokens of the laser's color into lasers. Activating an overload, combining it, or hitting it in a chain fires **every active special already on the board**, regardless of color or distance. Existing bombs keep their bomb effect rather than being overwritten by converted lasers. Each special fires once in a chain; toolbar inventory is unaffected. Two bombs clear a larger area and two overloads clear the board. The rewarded inventory Overload button injects a core; activate that board core to fire it.

Purge Hazard now removes **all board hazards**, including both shield layers, boss locks and vaults. A purged vault credits its full objective. Data packets remain intact, and Purge spends no move. Attempting Purge on a hazard-free board preserves the booster.

**Hacker Training** provides three playable lessons: a basic swap, clearing two lines to create a Cross Laser, and breaking an adjacent ICE shield. Hints appear after seven idle seconds, or when the Hint button is pressed. Hints never spend moves or boosters.

Training outlines the two practice cells, gives a numbered selection prompt, supports taps, dragging and keyboard swaps, and explains the result after each lesson. Wrong practice swaps spend no moves. The opening lessons use the original pieces so their color names agree with the instructions.

Campaign stars reward completion, at least five moves remaining, and using no boosters. Replays retain your best stars and score. Every completed campaign run, including a replay, grants booster loot once; duplicate completion callbacks and checkpoint reloads cannot pay that run again. The completion card shows the awarded quantities and scrolls on small screens. Achievements and mastery stars unlock four cosmetic palettes, including matching hacker clothing and aura colors in the full city scene. Music choices remain in Settings; cosmetics provide no rule or scoring advantages.

Campaign clears also grant separate career XP. Base XP is `100 + 25 × (difficulty tier − 1) + 50 on security-core levels`. Using an inventory booster gives base XP only; targeting and cancelling a booster does not count. A booster-free clear uses `1.25 + 0.10 × (tier − 1) + 0.25 on security cores + 0.75 × move efficiency`, rounded to two decimals. Move efficiency is the unused fraction of the original level move budget, clamped to 0–1. Accepted swaps (including invalid swaps that spend a move) and fired board specials count toward moves taken. Counters survive resume, including move injections, which disqualify the clean multiplier. Legacy saves infer prior moves from their remaining budget. The completion card shows moves, difficulty, base/bonus XP and multiplier; the hub shows accumulated XP and a rank every 1,000 XP. XP does not modify match score or daily rankings. Replays earn XP once per completed run; training and daily runs retain their separate reward rules.

Every completed tenth campaign node (10, 20, 30, …), including a replay, unlocks a free slot-machine bonus before the next campaign run. Normal completion loot appears first; choose **Play Bonus Slot Round**. Three reels always match one of the five uniformly selected boosters. Power ratings determine quantity as `6 − power`:

| Power | Matching booster | Amount |
| --- | --- | --- |
| 1 | +5 Move Injections | 5 |
| 2 | EMP Blasts | 4 |
| 3 | Cross Lasers | 3 |
| 4 | Hazard Purges | 2 |
| 5 | Overload Cores | 1 |

The outcome is saved before opening the slot machine. A payment receipt is written before inventory changes; recovery reapplies its exact balance once after an interrupted write. Reloading an unspun bonus keeps its outcome. Reloading during a spin shows the paid match without another payment. Continue clears the receipt and opens the next level. The machine scrolls on short screens, uses large controls, and shortens its animation for reduced motion.

Piece collections are separate from board palettes: Casino Originals are available immediately; Prismatic Gems unlock at 5 distinct breached nodes, Arcade Blocks at 10, and Orbital Relics at 20. A victory shows newly won sets with an Equip button. Open Campaign Map & Daily Heist → Cosmetics to change sets later. Replays cannot duplicate collection rewards. Equipped sets persist on this browser, retain the five original color identities, and work on both the 3D and GPU-free boards.

Background chapters change immediately when each tenth campaign level is cleared: Neon District skyscrapers (1–10), floating Quantum Vaults (11–20), Black Lotus gardens (21–30), AI Central server stacks (31–40), Singularity asteroids (41–50) and Matrix Horizons floating islands (51–60). The victory screen already shows the next chapter, and its checkpoint keeps that environment after reload. Each has its own sky, structures and animation, including traffic, orbital rings, drifting petals, data streams, a vortex or aurora. Scenery continues cycling in the endless frontier. Action and effect sounds use matching pitch, waveform and impact-filter profiles, including lasers and explosions. Volume and mute preferences remain independent. Reduced motion freezes chapter animation.

The daily challenge uses the UTC date and a versioned deterministic seed. All players start with the same board, one EMP, and one laser. Campaign boosters and saves are isolated from daily and training runs. Personal bests are local to this browser. `game/replay.ts` can recompute a daily action receipt and reject invalid actions, excess boosters, or a forged score; online rankings still require a server that runs that validation itself.

**Settings** includes low/medium/high graphics, adaptive pixel density, particle caps, reduced motion, keyboard controls, and idle hints. Every quality preset renders the complete city, hacker, sentinel, holograms, floor, and board. Presets change pixel density, antialiasing, and particle budgets. Reduced motion freezes decorative movement, fixes the camera, and suppresses particle bursts and CSS animation. Arrow keys move board focus, Enter selects, and Shift + arrow swaps. Hazard badges show shield health; vault badges show hits remaining. Token symbol overlays stay hidden and their toggle has been removed. The settings X stays visible outside the scrolling content and closes immediately; changed settings are saved automatically.

The board restores the original dark reflective surface, cyan/magenta lighting, token materials, and animated effects. Inner grid lines are faint and 0.01 scene units wide; the glowing outer frame is 0.08 units wide. Swaps, invalid moves, matches, cascading refills, special creation, lasers, EMP blasts, overloads, hazards, and boss lockdowns have distinct sound or animation feedback. The main menu is a full-screen page over the animated neon city, including when returning from a heist.

Gameplay RNG, IDs, and progress counters are saved in settled snapshots. Rendering and music use separate randomness. Legacy saves retain a score objective for the resumed node. New campaign nodes use the expanded mission rules.

## Balance simulations

```sh
npm run balance
npm run balance -- 50
```

The default command simulates **2,400 seeded boards** across 12 representative early and later nodes and writes `reports/balance.json`. The optional argument selects seeds per node. The policy ranks legal moves by objective proximity and uses one EMP if unfinished with five moves remaining. The report separates assisted wins, unassisted wins, move reserve, score, and booster use. These are bot results, not measured human difficulty. `reports/balance-baseline.json` preserves the initial 2,000-board run; packet missions received four extra moves after that run.

The menu and game are separate production chunks. The renderer still contains a substantial Three.js dependency, so Vite reports a large game chunk. Software-WebGL browser tests cover desktop and Pixel 7 touch emulation; physical-phone frame rate and audible external music are not measured by that suite.

## Responsive layout and rendering

The game uses the dynamic viewport height and device safe areas. Controls adapt to both width and height; five boosters fit narrow screens without a hidden horizontal action row. Menus and settings scroll on short screens. The board has reserved space for its objective and hint controls and refits immediately after resizing or rotation. Camera parallax responds to a mouse rather than touch taps.

Graphics presets retain the entire scene. They change curved geometry detail, framebuffer density, particle budgets, animated billboard resolution and update rate. Rendering targets 30/45/60 frames per second for low/medium/high, reduces its budget on sustained slow rendering, and recovers gradually. Pixel budgets prevent large displays or excessive device density from allocating oversized framebuffers. Gameplay pauses when the page is hidden; continuous scene rendering stops while paused. These budgets are limits, not guaranteed physical-device frame rates.

When WebGL 2 is unavailable or its context is lost, a responsive DOM board keeps the same engine, 64 tiles, input controls, effects and saved progress. A Retry 3D visuals button can restore the GPU surface without resetting the heist. The main menu retains its CSS city background on unsupported hardware.

```sh
npm run test:e2e -- responsive.spec.ts
```

The responsive suite covers Chromium, Firefox and WebKit, small phones, landscape phones, portrait/landscape tablets, laptops and ultrawide screens. It checks actual control bounds, camera-projected board corners, live rotation, settings access and real clicks/taps on the GPU-free fallback. WebKit testing is an engine check, not a test on a physical iPhone or native Safari installation. Legacy browsers without the JavaScript/CSS capabilities needed by the application are outside the supported range.
