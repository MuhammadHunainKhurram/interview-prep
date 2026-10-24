# Interview Prep

A Chrome extension for working through **NeetCode 150 → NeetCode 250** (plus Blind 75 and
NeetCode All) without forgetting what you've learned.

- **On-page tracker** on NeetCode and LeetCode problem pages: timer, four outcomes
  (Solved easily · Solved · Needed hints · Didn't solve), patterns and notes
- **Spaced repetition** (FSRS): problems come back for a full re-solve, with longer gaps
  each time you solve them
- **Daily plan** in NeetCode roadmap order, with at least one review a day and a review cap
- **Streaks** with a GitHub-style heatmap, weekly rest days and extra rest days
- **Stats**: progress per list and topic, weak topics, average solve time, finish forecast
- Solving on either site counts. NeetCode and LeetCode URLs map to the same problem.
- All data stays in your browser. Export/import JSON backups any time.

## Install (from source)

Requires Node.js 22+.

```bash
git clone <this repo>
cd interview-prep
npm install
cp .env.example .env   # optional; defaults work as-is
npm run build
```

Then in Chrome open `chrome://extensions`, turn on **Developer mode**, click
**Load unpacked** and select `.output/chrome-mv3`.

For development with hot reload: `npm run dev` (opens a Chrome instance with the extension
loaded).

## Using it

1. Open any problem on [neetcode.io](https://neetcode.io/practice) or leetcode.com. A small
   pill appears in the top-right corner. Click it (or press **Alt+Shift+S**).
2. Click **Start** when you begin. Pick the pattern and add notes if you like.
3. When you're done, click how it went. That stops the timer and saves the attempt.
   Clicked the wrong one? Hit **Undo** within 5 seconds, or edit it later in History.
4. The toolbar popup shows today's plan and streak. The dashboard has everything else.

## Configuration

`.env` is optional. Values are bundled into the extension and readable by anyone who
installs it, so **never put secrets in it**.

| Variable                | Default | Purpose                                                     |
| ----------------------- | ------- | ----------------------------------------------------------- |
| `WXT_STORAGE_BACKEND`   | `local` | `local` (chrome.storage). `supabase` is reserved for later. |
| `WXT_SUPABASE_URL`      | empty   | Only for the future Supabase backend                        |
| `WXT_SUPABASE_ANON_KEY` | empty   | Public anon key only, protected by row-level security       |

## Scripts

| Command           | What it does                                               |
| ----------------- | ---------------------------------------------------------- |
| `npm run dev`     | Dev build with hot reload                                  |
| `npm run build`   | Production build into `.output/chrome-mv3`                 |
| `npm run zip`     | Zipped build                                               |
| `npm run check`   | Typecheck, lint, format check and unit tests               |
| `npm test`        | Unit and integration tests (Vitest)                        |
| `npm run e2e`     | End-to-end tests in Chromium (run `npm run build` first)   |
| `npm run catalog` | Regenerate the problem catalog from NeetCode's public data |

The first time you run `npm run e2e`, install the browser with
`npx playwright install chromium`.

## Architecture

```
src/
  core/          Pure domain logic. No browser APIs, no React (enforced by ESLint).
    calendar/    Logical days (2 AM rollover), rest days
    catalog/     Problem lists, NeetCode ↔ LeetCode mapping, URL parsing
    model/       Zod schemas for settings and records, with all limits
    srs/         Scheduler interface + FSRS implementation
    planner/     Daily plan
    streak/      Day status, streaks, heatmap
    stats/       Progress, weak topics, forecast
  data/          Storage boundary: repositories, chrome.storage driver, migrations, backups
  background/    Service layer + message router (the only writer of data)
  shared/        Typed messaging contract, config, UI kit and theme
  features/      One folder per feature (widget, home, problems, reviews, history, stats, settings)
  entrypoints/   WXT entrypoints: background, popup, dashboard, content script
```

Key design choices:

- **Attempts are the source of truth.** Review schedules are recomputed from attempt history,
  so editing, deleting or undoing an attempt is always reflected correctly, and syncing
  later only needs to move attempts.
- **Past days are frozen** in per-day snapshots, so changing your goal or rest days never
  rewrites your streak history.
- **Every message is validated** with Zod and checked to come from this extension.
  **Every stored record is validated** on read. Invalid records are quarantined, never
  deleted.
- **Adding a dashboard page** means adding a folder under `src/features/` and an entry in
  `src/features/registry.tsx`.
- **Adding a storage backend** means implementing `Repositories` (`src/data/repositories.ts`)
  and selecting it in `src/data/create-repositories.ts`.

See [docs/DESIGN.md](docs/DESIGN.md) for the full design.

## Privacy

No analytics, no tracking, no network requests. The extension only runs on
`leetcode.com` and `neetcode.io`, and stores data in `chrome.storage.local`.
