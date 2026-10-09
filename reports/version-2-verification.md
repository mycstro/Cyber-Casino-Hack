# Cyber Casino Hack version 2 verification

Date: 2026-10-09. Compared with the stable `main` version. Implementation is on `version-2`.

## Graphics and resolution

The reported displaced, oversized background was a real regression: the transformed game shell was measured again in physical display coordinates by the canvas. Both game and menu canvases now measure the logical viewport, and the fallback board uses its layout dimensions. The rings retain their original proportions and sit behind the signs, holograms and sentinel. Foreground signs and the sentinel were moved away from playable cells.

Resolution defaults to 1920 × 1080 independently of display size. Settings also offer 720p, 1440p, 2160p and native display. At 4K, the standard interface scales by two. Smaller screens keep responsive layouts and camera framing. The existing faint board dividers, bold perimeter, hidden token symbols, settings close button, effects, sounds and ten-level environments remain intact.

## Training

Hacker Training contains the course, lesson selection and performance; there is no separate course button in the main menu. Start Guided Training continues with the first unfinished lesson, and any lesson can be replayed. The course has 22 lessons, including ten real board exercises and twelve explicitly acknowledged explanations.

Coverage includes HUD and device controls, three/four/five matches, two-line Cross creation, Cross activation, three-line move bonuses, shields, EMP, Overload chains, all-hazard Purge, move injections, rewards, slots, XP, chapters, collections, profiles, races, mission objectives, bosses, hints, saving and special combinations. Practice boosters are free. Mistakes do not spend moves or career inventory. Instruction height is measured so longer explanations do not cover the board.

Performance records completed lessons, attempts, completions, best/last moves and best/last/total mistakes. Guest results stay on the device. Signed-in results persist privately in SQLite with idempotent retry receipts, and device input preferences are saved in the profile. Pending attempts appear immediately in that account's course view and retry automatically when connectivity returns. Serialized synchronization preserves newly queued attempts and prevents stale responses from changing another account. These practice metrics are self-reported and do not affect competitive rankings.

## Accounts, races and rewards

The Node service provides password accounts, profiles, password changes, deletion, public leaderboards and up to four players in a hosted race. Mutations require the cookie session, CSRF token and exact origin. Passwords are salted and hashed; session tokens are hashed in storage. Public leaderboard responses contain only display name, public ID and verified game statistics.

Race players receive the same seeded board and synchronized countdown. The first objective completion accepted by the server wins. Results offer the next level together, next level solo and main menu. Hosting is available through settings and the main menu's account/multiplayer entry. Inventory boosters are disabled in races; earned board Crosses and match move bonuses remain available.

Fresh signed-in solo runs use server-validated actions and authoritative inventory. Consuming boosters and awarding completion packs happen once, without a second client deduction or addition. Restored local saves use guest inventory and remain unranked. Milestone prizes are fixed by the server and returned with the winning action receipt; account bonuses cannot fall back to a local payout. Guest prizes and account prizes are kept separate. Late responses after logout or a new run cannot restore an old profile or apply an old move.

HTTP Wi-Fi play uses cryptographically random receipt IDs even when the browser does not expose `crypto.randomUUID()` outside a secure context.

## Validation

- Production build and TypeScript checks passed.
- Full unit/application/backend suite: **215 tests passed across 23 files**, with no unhandled errors.
- Dependency audit, including development dependencies: **0 vulnerabilities reported**.
- Balance simulation: **2,400 seeded runs** across twelve representative levels. This is a bot simulation, not a human completion-rate or device-performance benchmark; details are in [balance results](balance.json).
- All **116 distinct game browser cases passed** across the full run and targeted rerun. The initial run passed 108 cases and exposed eight measurements taken before rotation settled. The test now waits for HUD width and dock height together; a fresh production build passed all **38 responsive, slot-layout and full-curriculum rerun cases**, including every initially failed case. This correction retains the original viewport bounds assertions.
- The game matrix includes Chromium desktop and touch emulation, 320-pixel phones, landscape phones, tablet orientations, laptop, ultrawide, 4K, Firefox, WebKit and installed Edge. Fresh screenshots were visually inspected for centered background rings, foreground clearance, faint board lines and readable course layouts: [4K menu](v2-4k-menu-desktop.png), [4K board](v2-4k-board-desktop.png), [desktop course](training-course-desktop.png) and [mobile course](training-course-mobile.png).
- All **four account/race browser flows passed again on the final build** in 2.8 minutes, using isolated in-memory test accounts on desktop Chromium and touch emulation. They cover training completion and saved profile controls, login/password/deletion, leaderboard, two independent race participants, identical boards, native first swap, server-validated finishing actions, results, next-level voting, settings hosting and menu return. Remaining race actions use the action API; these checks do not claim every action was entered through the UI. Together with the game suite, **120 distinct browser cases passed**.
- The local built game and session API returned HTTP 200. Live social providers remain disabled without operator credentials. Active test accounts and databases were isolated from the local running server.
- The Visualize race-destination explainer passed all three interaction checks.

## Configuration and limits

Facebook and Instagram OAuth are implemented and tested with provider fixtures. Live use requires the operator's Meta app credentials, approved HTTPS callbacks and provider configuration. Instagram supports professional Business/Creator accounts rather than ordinary personal accounts. No live provider login is claimed.

Accounts, statistics, inventory, training and reward receipts survive server restart. Active rooms and solo boards are currently in memory, so a restart interrupts those games. The server supports one small deployment; multi-process matchmaking and email password recovery are not implemented. Guest career XP, stars, collections and daily records remain device-local. Physical device frame rates and every possible browser/device combination are not established by browser emulation and software WebGL.

Runtime databases, real credentials, account data, browser traces and user reference screenshots are excluded from Git. Commits use the generic project identity. See [server setup](../README-server.md) for local, Wi-Fi and public-hosting configuration.
