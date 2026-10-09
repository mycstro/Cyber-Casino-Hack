# Version 2 account and multiplayer server

Node 22.12+ is required. Run `npm ci`, `npm run build`, then `npm run server`. The server serves `dist` and `/api` together on `http://localhost:3001`. For frontend development, start the server with `PUBLIC_ORIGIN=http://localhost:5173` and run Vite separately. The browser origin must match exactly, including port. `.env.example` contains placeholders; copy to an untracked `.env` and use `node --env-file=.env --import tsx server/index.ts`. Never publish real credentials or the SQLite database.

For Wi-Fi play, set `HOST=0.0.0.0` and `PUBLIC_ORIGIN=http://YOUR-LAN-IP:3001`. All players open that same URL. Public hosting requires HTTPS, a persistent private writable `DATABASE_PATH`, and a reverse proxy that preserves the public origin. HTTPS enables Secure cookies automatically. The service does not trust forwarding headers or enable cross-origin requests.

## Accounts and privacy

Accounts use a username, display name and password. No email, date of birth, location or contact list is collected. Scrypt derives salted password hashes asynchronously. Session tokens are random, stored as SHA-256 hashes, and sent in HttpOnly, SameSite cookies. Mutations require a session CSRF token and exact Origin, including registration and login. Password changes invalidate every previous session. Password-account deletion requires the password; social-account deletion requires its authenticated session and CSRF token. Deletion cascades through sessions, reward receipts and bonus records. Public leaderboards expose the chosen display name and verified stats; use an alias if you do not want a public name. SQLite backups are the operator's responsibility and are not automatically erased by deleting an account.

Facebook login requires a Meta app, configured client ID/secret, and callback `PUBLIC_ORIGIN/api/oauth/facebook/callback`. Instagram login uses Instagram API with Instagram Login, which supports professional Business and Creator accounts, not ordinary personal Instagram accounts. Its callback is `PUBLIC_ORIGIN/api/oauth/instagram/callback`. Both providers show disabled until server credentials exist. Meta app review, HTTPS redirect configuration, privacy policy and data-deletion configuration must be completed by the operator before general public social login. OAuth uses a short-lived single-use state tied to the initiating browser session. Access tokens are used for the profile lookup and are not saved. Provider profiles are not merged with password accounts by name.

## Training and device controls

Signed-in profiles save each curriculum lesson's attempts, completions, last move count, best completed move count, total practice mistakes and best/last mistake count. Concept lessons can be acknowledged without a move. Training submissions are self-reported practice metrics; they never award ranked scores, multiplayer wins, inventory or slot prizes. Each attempt uses a unique request ID, so a network retry cannot count it twice. Existing profiles gain newly added curriculum lessons while retaining their earlier metrics.

Profiles also remember preferred input separately for desktop (pointer or keyboard), mobile (touch), and tablet (touch or pointer), plus the keyboard accessibility preference. Training and control preferences are private to the signed-in profile; public leaderboard entries include only display name, ID and verified game stats. Account deletion removes the saved preferences, lesson metrics and training retry receipts.

`POST /api/training {requestId,lesson,moves,completed,mistakes?}` records a finished practice attempt. Lesson IDs come from the shared curriculum; moves must be an integer from 0 to 1000. The optional mistake count must be an integer from 0 to 10000 and defaults to zero; old completed lessons keep unknown best/last mistake counts as null. `PATCH /api/controls {device,mode,keyboardEnabled?}` updates one device's preferred input. Both endpoints require the authenticated session, CSRF token and exact origin, and return the updated user profile.

## Verified game rules

The server runs the same deterministic HeistEngine as the browser. It supplies the multiplayer seed, level, budget and board, processes swaps in order, rejects inventory boosters in races, and awards the first verified completed objective. All players receive the same board. Earned Cross Lasers and earned +5 moves are permitted. Completion order is the order actions are received and accepted by the server, not a client-reported timestamp. Completed players' final results include 200 points per remaining move in addition to their live board score; finishing first determines the winner.

Up to four players share an eight-character room code. The host starts with at least two players and a three-second synchronized countdown. Results show everyone, and all remaining players must choose next together before the next level starts. Leaving during a round forfeits it; the last remaining player wins. Hosts migrate to another connected player. A player who stops polling or acting for 60 seconds forfeits an active round. Exhausting the move budget ends that player's run. If everyone exhausts or disconnects there is no winner. Rooms expire after two hours without activity.

Signed-in solo statistics are recorded only for a fresh run begun through the server and actions it verifies. Existing offline/restored boards remain playable but cannot submit trusted statistics. Account booster inventory is separate from offline browser inventory. Account inventory starts with EMP2, Cross2, Overload1, +5Moves2 and Purge1. Verified completions grant the same small normal packs as campaign play. Every tenth verified solo completion additionally creates a persisted, predetermined slot prize: +5Moves5, EMP4, Cross3, Purge2 or Overload1. Claiming the same prize again cannot pay twice. Match and solo award receipts prevent duplicate stats.

Active rooms and solo boards are held in memory. **Restarting the server interrupts active games**, which must be started again; it does not award an unverified completion. Accounts, inventory, claimed rewards, pending slot prizes and statistics persist in SQLite. Running multiple server processes against one database is not supported because each owns separate live rooms. This initial server is intended for a single small deployment, not high-scale ranked matchmaking. No email-based password recovery is provided because no email is collected; keep your password safe.

## API

`GET /api/session` returns user, CSRF token, provider availability and pending bonus. `POST /api/register`, `/api/login`, `/api/logout`; `PATCH /api/profile`; `POST /api/password`; `DELETE /api/account`; `GET /api/leaderboard`. Mutations send JSON plus `X-CSRF-Token` and credentials.

Rooms: `POST /api/rooms`, `/api/rooms/join`, `GET /api/rooms/current`, and `POST /api/rooms/:code/start`, `/action`, `/next`, `/leave`. Actions include a unique `requestId`, the last accepted `sequence`, and a board action. Repeating an action ID returns its original receipt. Optional `expectedSerial` and `expectedRng` detect desynchronization.

Solo: `POST /api/solo/start {level,seed}`, `POST /api/solo/:id/action`, `POST /api/bonus/claim {id}`. Browser-provided scores, boards and completion flags are never accepted as authority.
