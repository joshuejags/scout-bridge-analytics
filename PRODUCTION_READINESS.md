# Scout Bridge Analytics — Production Readiness Report

**Date:** 2026-07-25
**Scope:** Full page-by-page UX/copy review (Task 3), reconciled against the prior full-codebase gap analysis and the blocker-fix pass already shipped.
**Status of prior work:** The 4 launch-blocking issues identified in the earlier gap analysis, plus an app-wide error-handling pass, have already been implemented and merged into the working tree (see "Already fixed" callouts throughout). This report reflects the *current* state, not a repeat of already-resolved findings.

**Nothing in the "Page-by-Page Review" or "Punch List" sections below has been implemented.** These are findings and proposed changes for your review. The only code change in this pass is the README.md update, done directly per your instructions.

---

## Executive Summary

The product is functionally complete and well-tested (113 backend / 75 frontend / 21 Python tests, all green) with no remaining process-crash or dead-end-navigation blockers — those were fixed in the prior pass. **It is not yet ready for a public launch with real user footage**, for one reason that overrides everything else: there is no privacy policy, terms of service, or data-deletion mechanism, and this product stores identifiable video of real people. Below that single hard blocker, the biggest gaps are operational rather than functional — no database indexes on hot query paths, no rate limiting on the two most abuse-prone endpoints, no durable job queue, and no uptime/error alerting beyond what was stubbed in the last pass. The two internal management pages (Teams, Players) are also visibly the least finished screens in the app and would benefit from a focused pass before launch, though nothing on them is broken.

---

## Punch List

Grouped by area, blockers first. Each item notes whether it's newly found in this pass or carried over from the prior gap analysis (still open — not yet fixed).

### 🛑 Blocker

| # | Item | Area | Status |
|---|---|---|---|
| 1 | No privacy policy / ToS / data-retention or deletion policy, despite storing identifiable video footage. The engineering half (cascading a video's own analysis/thumbnail data on delete) is done — the policy itself does not exist. | Product/Legal | Carried over — explicitly not something I can draft; needs your/legal sign-off |

### Frontend

| Priority | Item | File | Status |
|---|---|---|---|
| High | No favicon, Open Graph tags, or real meta description | `client/public/index.html` | Carried over |
| High | Pure client-rendered SPA — no per-route `<title>`, no SSR/prerendering, so every page shares one generic browser tab title and a non-JS crawler sees only the static shell | app-wide | Carried over |
| High | Dashboard's recent-videos list shows the server-generated storage filename instead of the human-readable upload name | `client/src/pages/DashboardPage.jsx:74` | **New** (this pass) |
| Medium | Dashboard's "View Analysis" link is a raw `<a>`, forcing a full page reload instead of client-side navigation | `client/src/pages/DashboardPage.jsx:82` | Carried over |
| Medium | No edit UI for Teams or Players despite the backend supporting `PUT` for both — the only way to correct a mistake today is delete + recreate, which also orphans any `Player.team` references pointing at a deleted team | `client/src/pages/TeamsPage.jsx`, `PlayersPage.jsx` | **New** (this pass) |
| Medium | `VerifyEmailPage`'s post-verification link reads "Go to dashboard" but routes to `/` (Home), not `/dashboard` (Dashboard) | `client/src/pages/VerifyEmailPage.jsx:54` | **New** (this pass) |
| Medium | "Key moments" panel has no empty state — an analysis with zero highlighted moments renders an empty list under the heading with nothing explaining why | `client/src/pages/AnalysisPage.jsx:82-91` | **New** (this pass) |
| Medium | "Pending" status filter always shows zero results — no video in the app ever has that status value | `client/src/components/VideoList.jsx:259` | Carried over |
| Medium | Design tokens (`var(--primary-color)` etc.) defined in `App.css` are bypassed with raw hex in several files, including Teams/Players | `TeamsPage.css`, `PlayersPage.css`, `VideoList.css` | Carried over |
| Medium | No pagination/virtualization on Video List, Teams, or Players — all render their full collection at once | `VideoList.jsx`, `TeamsPage.jsx`, `PlayersPage.jsx` | Carried over |
| Low | No route-level code splitting (`React.lazy`/`Suspense`) | `client/src/App.jsx` | Carried over |
| Low | Accessibility: search input has no label/`aria-label`; comparison modal has no focus trap or Escape handler; borderline text contrast (`#777` on white, ≈4.48:1) | `SearchFilter.jsx`, `PlayerComparison.jsx`, several `.css` files | Carried over |
| Low | `chart.js`/`react-chartjs-2` are installed but never imported anywhere — likely intended for a richer Dashboard that was never built (see Dashboard notes below) | `client/package.json` | Carried over, newly explained |
| Low | Toast notifications never auto-dismiss; delete confirmations use native `window.confirm()` instead of the app's own modal/toast pattern | `Toast.jsx`, `TeamsPage.jsx`, `PlayersPage.jsx` | Carried over |

**Already fixed (verify, don't re-flag):** no catch-all 404 route → now has `NotFoundPage` wired into `App.jsx`; mobile video table clipping → `VideoList` now scrolls horizontally; silent stats-fetch failure on Home → now shows a retry banner; thumbnail/preview load failures → now show a retry button instead of hanging on "Loading...".

### Backend

| Priority | Item | File | Status |
|---|---|---|---|
| High | No index on `Video.filename`/`Video.user` or `Analysis.video` — both are full collection scans on the hottest read paths (every media request, every report load) | `server/models/Video.js`, `Analysis.js` | Carried over |
| High | No rate limiting on video upload or `POST /api/analysis/:videoId/process` — the latter runs against a 2-worker CV pool, so one user can starve everyone else | `server/routes/videoRoutes.js`, `analysisRoutes.js` | Carried over |
| High | Analysis job queue is plain in-memory (no Bull/BullMQ/Redis) and unbounded — a restart mid-job silently loses it, and nothing caps how many jobs can queue up | `server/utils/analysisWorkerPool.js` | Carried over |
| High | No backup strategy for MongoDB or uploaded video/derived data | — | Carried over |
| Medium | `playerController.js` almost certainly leaks the same raw Mongo duplicate-key/validation errors that `teamController.js` did before the last pass fixed it there specifically | `server/controllers/playerController.js` | Carried over, explicitly not yet applied here |
| Medium | `analysisController`'s real business logic (successful process run, track merge/update) is still essentially untested beyond the new crash-path regression test | `server/tests/` | Carried over |
| Medium | `video_analyzer.py`'s core `analyze()` function has zero test coverage — only small pure-logic helpers around it are tested | `server/cv/video_analyzer.py` | Carried over |
| Medium | Team/Player create and update pass raw `req.body` into Mongoose with no field allowlist | `teamController.js`, `playerController.js` | Carried over |
| Low | No migration tooling — fine while the schema stays simple | — | Carried over |
| Low | Chunked-upload `uploadId` param isn't format-validated (low risk — resolves to a safe `Map.get()` miss) | `server/routes/videoRoutes.js` | Carried over |

**Already fixed (verify, don't re-flag):** `processAnalysis` crash risk → wrapped in try/catch + `unhandledRejection` safety net, with a regression test; `teamController` raw error leakage → cleaned up via `mongooseErrors.js`; invalid-type/oversized uploads → now `400`/`413` instead of `500`; zero-detection analyses → now flagged `no_detections` instead of a silent empty success; video deletion → now cascades to its `Analysis` doc and thumbnails.

### Infrastructure

| Priority | Item | Status |
|---|---|---|
| High | CORS is wide open (`cors()` with no options) — `CLIENT_URL` already exists and is never wired into it | Carried over |
| High | No security-headers middleware (`helmet` or equivalent) — missing CSP/HSTS/X-Frame-Options | Carried over |
| High | Model weights (`yolov8n.pt`, `yolov8n-pose.pt`) aren't pinned or baked into the Docker image — lazily re-downloaded from Ultralytics' CDN on the first analysis after every deploy | Carried over |
| High | CPU-only inference throughput has never been validated against realistic full-length footage — only a ~4-second smoke-test clip | Carried over |
| Medium | `/api/health` doesn't check MongoDB connectivity — Railway's healthcheck could report "healthy" with the DB down | Carried over |
| Medium | No uptime monitor provisioned — `/api/health` exists to point one at, but no external account (UptimeRobot, Better Uptime, etc.) has been set up | Carried over, now documented in README |
| Low | CI runs tests/build on every push, but there's no CD — Railway deployment is manual (though well-documented) | Carried over |

**Already fixed (verify, don't re-flag):** no error tracking → Sentry now wired on both client and server behind `SENTRY_DSN`/`REACT_APP_SENTRY_DSN`, inert until a DSN is set.

---

## Page-by-Page Review

Every routed page in `client/src/App.jsx`, reviewed individually. Nothing below has been implemented — copy suggestions are proposals.

### Landing Page (`pages/LandingPage.jsx`) — signed-out `/`

**Purpose:** Public marketing page. Hero, clickable feature tabs, a "how it works" accordion, and a real sample report (genuine seeded match data, not placeholder numbers) with a CTA band at the end.

**Findings:** This is the most polished page in the app. Copy is specific and confident throughout ("Turn match footage into scouting data," per-feature descriptions that name real technical tradeoffs rather than generic marketing filler). No placeholder text, no lorem ipsum, no styling inconsistencies found.

**One real gap:** the page ends abruptly after the final CTA band (`LandingPage.jsx:212-217`) — no footer at all. For a page that's explicitly the first thing a prospective user sees, the absence of any Privacy/Terms/Contact link reads as unfinished, and directly blocks the privacy-policy item above from being discoverable once it exists.

**Proposed addition** (once a privacy policy exists — this is blocked on the Blocker item above, not something to build now):
```jsx
<footer className="landing-footer">
  <span>© {new Date().getFullYear()} Scout Bridge Analytics</span>
  <div className="landing-footer-links">
    <Link to="/privacy">Privacy</Link>
    <Link to="/terms">Terms</Link>
    <a href="https://github.com/joshuejags/scout-bridge-analytics" target="_blank" rel="noreferrer">
      GitHub
    </a>
  </div>
</footer>
```

### Home (`pages/Home.jsx`) — signed-in `/`

**Purpose:** Authenticated landing page — time-of-day greeting, 5 stat cards, a collapsible upload panel, the full video list, quick-action links, and a recent-activity feed.

**Findings:** Solid, warm copy ("Here's what's happening with your match analysis today."). Already has a working error/retry banner and loading state (fixed in the prior pass). No placeholder content.

**Minor polish:** the recent-activity feed (`Home.jsx:147-160`) intentionally no-ops when clicking a not-yet-analyzed video (`e.preventDefault()`), but gives no feedback about *why* the click did nothing — it just silently doesn't navigate. Proposed:
```jsx
<Link
  key={video._id}
  to={video.status === 'analyzed' ? `/analysis/${video._id}` : '#'}
  className="home-activity-item"
  onClick={(e) => video.status !== 'analyzed' && e.preventDefault()}
  title={video.status === 'analyzed' ? undefined : `Still ${video.status} — check back soon`}
>
```

### Dashboard (`pages/DashboardPage.jsx`) — `/dashboard`

**Purpose:** Per `Home.jsx`'s own link text, this is meant to be the "Full Dashboard — see all-time analytics." As built, it's 4 stat cards (Videos/Analyzed/Teams/Players — no Processing count) plus the 5 most recent videos.

**Findings — two confirmed bugs:**
- **`DashboardPage.jsx:74`** renders `video.filename`, not `video.originalName`. `filename` is the server-generated storage name (`Date.now() + extension`, e.g. `1721838293747.mp4`) — every other list in the app (`Home.jsx`, `VideoList.jsx`) correctly shows `originalName`, the human-uploaded name. On this page, every recent video will display as an unreadable timestamp filename. **Concrete fix:** `<h4>{video.originalName}</h4>`.
- **`DashboardPage.jsx:82`** uses `<a href={...}>` instead of a router `Link` (needs `import { Link } from 'react-router-dom';` added — not currently imported). **Concrete fix:**
  ```jsx
  <Link to={`/analysis/${video._id}`} className="view-button">
    View Analysis →
  </Link>
  ```

**Open question, not assumed:** as it stands, Dashboard shows *strictly less* than Home already shows on one page (no Processing count, no quick actions, no upload panel) — it reads like an earlier, simpler stats page that predates Home's redesign and was never updated or removed. `chart.js`/`react-chartjs-2` are installed as dependencies but imported nowhere in the app, which is suggestive: this may be where charts were originally meant to live before that work stalled. **I'd rather ask than assume the intent** — is Dashboard supposed to become a genuinely deeper analytics view (trends, per-team breakdowns, the unused charting library put to use), or is it a leftover that should be retired/merged into Home? The two bug fixes above are safe regardless of the answer; anything beyond that should wait on this decision.

### Analysis Report (`pages/AnalysisPage.jsx`) — `/analysis/:videoId`

**Purpose:** The core product page — summary stats, action-type breakdown, key moments, a player stats table, heatmap, tactical shape, and the player-verification panel.

**Findings:** The most feature-complete page, and the one with the most recent direct attention (mobile scroll fix, the new no-detections banner). No placeholder content.

**One real gap:** the "Key moments" panel (`AnalysisPage.jsx:82-91`) has no empty state — a short or quiet clip with zero highlighted moments renders the heading with an empty list under it, which reads as broken rather than "nothing notable happened." **Proposed fix:**
```jsx
<div className="analysis-panel">
  <h3>Key moments</h3>
  {analysis.summary.highlightedMoments.length === 0 ? (
    <p className="empty-state">No standout moments detected in this clip.</p>
  ) : (
    <ul>
      {analysis.summary.highlightedMoments.map((moment, index) => (
        <li key={index}>
          <strong>{moment.type}</strong> at frame {moment.frameNumber}: {moment.description}
        </li>
      ))}
    </ul>
  )}
</div>
```

**Minor polish:** the header's "Sport: {sport}" (`AnalysisPage.jsx:43`) is a plain paragraph, while the action-type breakdown directly below it uses colored pill badges (`.action-badge`). A small tag treatment for the sport label would read more intentional next to that badge styling, e.g. reusing the existing badge pattern: `<span className="analysis-sport-tag">⚽ {analysis.video?.sport || 'soccer'}</span>` styled as a pill instead of plain text.

### Teams (`pages/TeamsPage.jsx`) — `/teams`

**Purpose:** Create, list, and delete teams.

**Findings:** This is one of the two least-finished screens in the authenticated app.
- Loading state is a bare string — `<div className="team-page">Loading teams...</div>` (`TeamsPage.jsx:60`) — instead of the app's own `LoadingSpinner` component, used consistently on Home, Dashboard, and Verify Email.
- List is unstyled `<ul><li>` markup rather than the card/table treatment used elsewhere (VideoList's table, PlayerComparison's stats grid).
- Empty state is bare text with no call to action: `<p>No teams yet.</p>` (`TeamsPage.jsx:92`).
- No search/filter (VideoList has one).
- **No edit capability**, despite `PUT /api/teams/:id` already working server-side — fixing a typo in a team name today means deleting and recreating it, which also silently orphans any `Player.team` reference pointing at the deleted team (nothing repoints or warns about those players).
- Delete uses native `window.confirm()` rather than the app's Toast-based feedback pattern (functional, just visually inconsistent).

**Proposed copy fixes (safe, no new functionality):**
```jsx
// Loading state
if (loading) {
  return <LoadingSpinner message="Loading teams..." />;
}
```
```jsx
// Empty state
<p className="empty-state">
  No teams yet. Add your first team above to start assigning players and rosters.
</p>
```
**Proposed UX addition (flagging the gap, not implementing):** an inline "Edit" affordance per team card — e.g. a pencil icon toggling the existing form into edit mode, pre-filled with the selected team's `name`/`description`, submitting via `PUT` instead of `POST`. This is a real feature addition and should be scoped as its own task rather than folded into a copy pass.

### Players (`pages/PlayersPage.jsx`) — `/players`

**Purpose:** Create, list, and delete players; select players for cross-match comparison.

**Findings:** Same structural issues as Teams — plain loading text (`PlayersPage.jsx:81`), unstyled list, no edit UI, native `window.confirm()`. Additionally, a large roster (the Analysis page already acknowledges "25+ players" as a realistic scale) renders as one long unbounded list with no scroll container, unlike the Analysis page's player table, which explicitly bounds its height for exactly this reason.

**Proposed copy fixes:**
```jsx
// Loading state
if (loading) {
  return <LoadingSpinner message="Loading players..." />;
}
```
```jsx
// Empty state
<p className="empty-state">No players yet. Add your first player above to start building a roster.</p>
```
*(Deliberately not claiming video analysis "auto-detects" roster players — it doesn't. `persistAnalysis` only matches tracked players to an* existing *roster entry by jersey number; it never creates new `Player` documents. Copy suggesting otherwise would be inaccurate.)*

**Proposed UX addition (flagging, not implementing):** same inline-edit pattern as Teams, plus a scroll-bounded list container once rosters grow past a page or two.

### Login / Register / Forgot Password / Reset Password / Verify Email (`pages/LoginPage.jsx`, `RegisterPage.jsx`, `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`, `VerifyEmailPage.jsx`)

**Purpose:** Standard auth flows.

**Findings:** All five are clean and complete — consistent `AuthForm.css` styling, correct disabled/loading submit states, real client-side validation (password length, confirm-password match), no placeholder text anywhere. `ForgotPasswordPage`'s confirmation copy is a good example of the app's voice done right: *"If an account exists for **{email}**, we've sent a link to reset your password. The link expires in 1 hour."* — specific, honest about the no-enumeration-leak behavior without over-explaining it.

**One real inconsistency:** `VerifyEmailPage.jsx:54` — `<Link to="/">Go to dashboard</Link>`. The label says "dashboard," but `/` renders `Home`, not the actual `/dashboard` route. A signed-in user clicking this after verifying their email expects the Dashboard page and lands on Home instead. **Proposed fix** (pick one, depending on intent):
```jsx
// Option A — fix the label to match the real destination (recommended;
// "/" is the more natural landing spot right after verifying)
<Link to="/">Continue to Scout Bridge Analytics</Link>
```
```jsx
// Option B — if the intent really was the Dashboard page specifically
<Link to="/dashboard">Go to dashboard</Link>
```

### Not Found (`pages/NotFoundPage.jsx`) — catch-all `*`

**Purpose:** Added in the prior pass to close the "blank page on a bad URL" gap. Self-reviewing it here since it's now a real page in the app.

**Findings:** Functional, matches `ErrorBoundary`'s visual pattern correctly. Copy is a little terser than the rest of the app's voice, which tends to explain itself in first person ("we've sent a link," "we couldn't..."). **Optional polish, low priority:**
```jsx
<h2>Page not found</h2>
<p className="not-found-message">
  We couldn't find that page. It may have been moved, or the link might be out of date.
</p>
```

---

## Open Questions

1. **Dashboard's purpose.** Is `/dashboard` meant to become a genuinely deeper analytics view than Home (trends, per-team breakdowns — the installed-but-unused `chart.js`/`react-chartjs-2` suggest this may have been the plan), or is it a pre-redesign leftover that should be retired or merged into Home? Blocks any further investment in that page beyond the two concrete bugs identified above.
2. **Team/Player editing.** Confirm this is a real gap worth scoping as its own task (it looks like one — the backend already supports it) rather than an intentionally deferred feature.
3. **Privacy policy ownership.** Confirmed in the prior pass as needing your/legal sign-off — flagging again here since it's the one item blocking a real launch. No draft has been written and none should be, per your instruction.
