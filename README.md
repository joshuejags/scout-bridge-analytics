# Scout Bridge Analytics

A comprehensive sports analytics platform built with MERN stack and Computer Vision. Upload match highlights to get detailed player performance data including tracking, action detection, and performance statistics.

## Features

- 📹 **Video Upload**: Upload match highlights in multiple formats (MP4, AVI, MOV, MKV, FLV)
- 🏅 **Multi-Sport**: Soccer, basketball, hockey, and rugby presets calibrate distance/speed accuracy and ball detection to each sport's real-world field size and ball color
- 👥 **Player Tracking**: Player detection and multi-object tracking using YOLOv8 + TrackTrack
- ⚽ **Ball Detection**: Color-based ball tracking and possession analysis
- 🔢 **Jersey OCR**: Automatic jersey-number reading and shirt-color classification, with a manual verification UI to fill the gaps OCR can't reach
- 🏷️ **Teams & Players**: Manage team rosters, player profiles, positions, and jersey numbers
- 🔐 **Accounts**: JWT auth with role-based access (admin/scout), email verification, and password reset
- 📊 **Performance Analytics**: Player statistics including distance covered, speed, sprint counts
- ⚖️ **Player Comparison**: Side-by-side cross-match stat comparison for two or more players
- 🔥 **Heatmaps**: Visualize player movement patterns and activity areas
- 🎯 **Action Detection**: Shots, passes, tackles, and interceptions, inferred from ball-possession transfers and sprint-near-ball heuristics
- ⚡ **Live Progress**: Analysis progress streams over WebSocket instead of waiting on polling

## Tech Stack

### Backend
- **Framework**: Express.js (Node.js)
- **Database**: MongoDB
- **File Upload**: Multer
- **Real-time**: Socket.IO (JWT-authenticated, broadcasts analysis progress/completion)
- **Computer Vision bridge**: Node spawns the Python CV pipeline as a background child process per analysis request

### Frontend
- **Framework**: React 18
- **Router**: React Router v6
- **HTTP Client**: Axios
- **Charting**: Chart.js
- **Styling**: CSS3

### Machine Learning
- **Object Detection & Tracking**: YOLOv8n (Ultralytics), TrackTrack tracker with appearance ReID
- **Jersey OCR**: EasyOCR
- **Python**: 3.13 (developed/tested on; 3.8+ should work but is untested)

## Project Structure

```
scout-bridge-analytics/
├── server/                 # Express backend
│   ├── models/            # MongoDB schemas
│   ├── controllers/        # Route controllers
│   ├── routes/            # API routes
│   ├── cv/                # Computer vision modules
│   ├── middleware/        # Express middleware
│   ├── utils/             # Utility functions
│   └── server.js          # Entry point
├── client/                # React frontend
│   ├── public/            # Static files
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── utils/         # Utility functions
│   │   ├── App.jsx
│   │   └── index.jsx
│   └── package.json
├── .env.example           # Environment variables template
├── .gitignore
├── package.json           # Root package config
└── README.md
```

## Installation

### Prerequisites
- Node.js >= 14.0
- npm or yarn
- MongoDB (local or cloud)
- Python 3.8+ (for CV components)

### Setup Steps

1. **Clone and Install Dependencies**
   ```bash
   git clone https://github.com/yourusername/scout-bridge-analytics.git
   cd scout-bridge-analytics
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set Up Python Environment** (for CV components)
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r server/requirements.txt
   ```

4. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

## Running the Application

### Development Mode
```bash
# From root directory - runs both server and client
npm run dev

# Or individually:
npm run server    # Runs Express server on port 5000
npm run client    # Runs React app on port 3000
```

### Production Build
```bash
npm run build
```

## API Endpoints

All routes below except `/api/auth/register`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-email`, and `/api/health` require `Authorization: Bearer <token>`. Routes marked **(admin)** additionally require the authenticated user's `role` to be `admin`.

### Auth
- `POST /api/auth/register` - Create an account `{ name, email, password }` (password ≥ 8 chars) → `{ token, user }`. Sends a verification email (or logs it to the console — see Email below). The first account ever created becomes `admin`; every account after that defaults to `scout`.
- `POST /api/auth/login` - `{ email, password }` → `{ token, user }`
- `GET /api/auth/me` - Current authenticated user
- `GET /api/auth/users` **(admin)** - List all accounts
- `PATCH /api/auth/users/:id/role` **(admin)** - `{ role: 'admin' | 'scout' }` - Change another user's role
- `POST /api/auth/verify-email` - `{ token }` (from the verification email link) → marks the account verified. Single-use, expires after 24h.
- `POST /api/auth/resend-verification` - Requires auth. Issues a new verification email for the logged-in account; 400 if already verified.
- `POST /api/auth/forgot-password` - `{ email }` → always `200`, regardless of whether the email is registered (prevents account enumeration). Rate-limited to 5 requests / 15 min per IP+email.
- `POST /api/auth/reset-password` - `{ token, password }` (token from the reset email link) → resets the password. Single-use, expires after 1h.

### Videos
- `GET /api/videos` - Get all videos
- `GET /api/videos/:id` - Get specific video
- `POST /api/videos/upload` - Upload video file. Accepts `sport` (`soccer` | `basketball` | `hockey` | `rugby`, default `soccer`), which calibrates the analyzer's distance/speed accuracy and ball detection (see Computer Vision Components below)
- `DELETE /api/videos/:id` **(admin)** - Delete video

### Analysis
- `GET /api/analysis/:videoId` - Get video analysis
- `POST /api/analysis/:videoId/process` - Start video analysis (returns `202` immediately; runs YOLO/tracking in the background). Progress streams over Socket.IO (`analysis:started`/`analysis:progress`/`analysis:complete`/`analysis:failed`, broadcast to all authenticated sockets); polling `GET /api/videos/:id` for `status` still works as a fallback.
- `PATCH /api/analysis/:analysisId/tracks/:trackId` - Manually set a track's jersey number / linked roster player / team color (marks it `verified: true`)
- `POST /api/analysis/:analysisId/tracks/merge` - Merge two player tracks that are the same real person into one

### Teams
- `GET /api/teams` - Get all teams
- `POST /api/teams` - Create a new team
- `GET /api/teams/:id` - Get a team
- `PUT /api/teams/:id` - Update a team
- `DELETE /api/teams/:id` **(admin)** - Delete a team

### Players
- `GET /api/players` - Get all players
- `GET /api/players/compare?ids=id1,id2,...` - Cross-match stat comparison for 2+ players (distance, speed, sprints, action counts by type)
- `POST /api/players` - Create a new player
- `GET /api/players/:id` - Get a player
- `PUT /api/players/:id` - Update a player
- `DELETE /api/players/:id` **(admin)** - Delete a player

### Media
- `GET /uploads/*` - Serves uploaded video files and player-verification thumbnails; requires the same Bearer token as the API (not a public static folder)

## Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/scout-bridge-analytics

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your_jwt_secret_key_here

# File Upload
MAX_FILE_SIZE=500000000  # 500MB
UPLOAD_DIR=./uploads

# CV/ML
PYTHON_ENV_PATH=./venv
YOLO_MODEL=yolov8n.pt
OPENPOSE_MODEL_PATH=./models/openpose

# Frontend
REACT_APP_API_URL=http://localhost:5000/api
CLIENT_URL=http://localhost:3000  # used to build password-reset/verify-email links

# Email (password reset + verification) — see "Email" section below
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Scout Bridge Analytics <no-reply@yourdomain.com>
```

## Email

Password reset and email verification send mail through `server/utils/email.js`. If `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are all set, it sends via that SMTP server — any provider works (SES, SendGrid, Postmark, a self-hosted relay) since they all speak SMTP. **This repo ships with no SMTP credentials configured anywhere** — with them unset, the email is logged to the server console instead of sent, so the reset/verify link is still visible and the whole flow is testable without real email infrastructure. This is deliberate, not a stub: a fallback that silently pretended to send would be worse than one that's loud about what it's actually doing. Configure real `SMTP_*` values before relying on this for real users.

## Computer Vision Components

Analysis is triggered by `POST /api/analysis/:videoId/process`, which spawns `server/cv/video_analyzer.py` as a background child process. The video's status moves `uploaded → processing → analyzed` (or `failed`); poll `GET /api/videos/:id` to watch it.

### Player Detection & Tracking (YOLOv8 + TrackTrack)
- YOLOv8n detects people per frame; Ultralytics' TrackTrack tracker (with appearance ReID) links detections into per-player tracks across frames
- On typical single-camera match footage a full 22-player match still fragments into 40-70+ raw tracks, since a player who is occluded or leaves frame gets a new ID — this is a real limitation of motion-only tracking, not a bug (see "Manual Player Verification" below)

### Jersey Number OCR + Team Color
- EasyOCR reads 1-2 digit jersey numbers from torso crops when a player's back faces the camera (numbers are not legible from front/side angles — this caps automatic identification to a small fraction of tracks on wide-angle footage)
- Each track is also classified into a coarse shirt-color bucket (HSV-based) every frame
- Tracks that agree on both a trusted jersey number and shirt color are automatically merged into one player

### Manual Player Verification
- Each surviving track gets a saved thumbnail crop (`server/uploads/thumbnails/<videoId>/<trackId>.jpg`)
- The Analysis report page has a "Verify Players" panel: a thumbnail grid where a human can set a track's jersey number, link it to a roster `Player`, or merge two tracks that are the same real person — closing the gap OCR and tracking alone can't close on real-world footage

### Ball Tracking
- Color-based (HSV) ball detection; the color range is chosen per sport (see Multi-Sport below)
- Possession approximated by nearest tracked player within a pixel radius
- Per-frame trajectory recorded

### Performance Metrics
- Distance covered (converted from pixel movement via a per-sport pixels-per-meter figure — derived from the video's actual frame width and the sport's real-world field length, not camera-calibrated, so treat as directionally correct rather than precise)
- Average speed and sprint-event counts (smoothed over a multi-frame window to filter detection jitter)
- Heatmap grid of player positions
- Action detection: "shot" (sprint near the ball, with a cooldown to avoid duplicate-frame spam), plus "pass"/"tackle"/"interception" inferred from ball-possession transferring between players — same shirt color is a pass, different shirt color close together is a tackle, different shirt color at a distance is an interception

### Multi-Sport
- `SPORT_PRESETS` in `video_analyzer.py` covers `soccer` (default), `basketball`, `hockey`, and `rugby`, each with a real-world field length (drives distance/speed accuracy) and a ball HSV color range
- Soccer's values are the original, footage-tuned defaults; the other presets are reasonable starting points that haven't been verified against real footage for that sport — confirm the ball color range against your own footage before relying on it
- Set via `sport` on `POST /api/videos/upload` (or the Sport dropdown in the upload form); passed to the analyzer as `--sport`

## Development Guidelines

### Backend Development
1. Create new routes in `server/routes/`
2. Implement controllers in `server/controllers/`
3. Define schemas in `server/models/`
4. Use middleware for validation and authentication

### Frontend Development
1. Create components in `client/src/components/`
2. Create pages in `client/src/pages/`
3. Use Axios for API calls
4. Follow React best practices

### CV Module Development
1. Add new CV modules in `server/cv/`
2. Implement detectors inheriting from base classes
3. Add logging for debugging
4. Update video analyzer to use new modules

## Testing

```bash
# Backend tests (Jest + Supertest, 52 tests: auth, password reset, teams, players + comparison,
# videos/sport, rate limiting)
npm test --prefix server

# Frontend tests (React Testing Library, 52 tests: AuthContext, Login/Register/reset pages,
# ProtectedRoute, LandingPage, VideoList/Upload, PlayerComparison, AnalysisPage)
npm test --prefix client -- --watchAll=false
```

Backend tests run against a disposable `scout-bridge-analytics-test` database (same `MONGODB_URI` host, different db name — set in `server/tests/setup.js`) so they never read or modify real data, and the database is dropped after each run. They talk to the Express app directly via `server/app.js` (no live server needs to be running separately — a local `mongod` reachable at `MONGODB_URI` is the only requirement).

Frontend tests mock `axios` and `useAuth` rather than hitting a real server, so they run standalone. CI runs both suites plus a production client build and a Python CV byte-compile check on every push/PR — see `.github/workflows/ci.yml`.

## Deployment

### Docker
```bash
docker compose up --build
```

Brings up MongoDB, the Express server, and the CRA dev server. The server image includes the full Python CV stack (ultralytics/torch/opencv/easyocr) alongside Node, since the analysis pipeline is core functionality, not optional — expect a large first build (torch alone is 500+ MB) and a multi-minute build time, longer on a slow connection since pip has no build-cache equivalent for the download itself. If you don't need GPU inference (this project runs CPU-only in practice — no CUDA device is assumed anywhere in the CV code), pointing pip at the CPU-only PyTorch wheel index cuts that download substantially; see https://pytorch.org/get-started/locally/ for the current index URL. Set a real `JWT_SECRET` via a `.env` file in the project root before running in anything other than throwaway local testing; `docker-compose.yml` falls back to a placeholder so `up` doesn't hard-crash with no config, but that placeholder must not be used for real data.

### Cloud Deployment
- AWS: EC2 + RDS + S3
- Google Cloud: Compute Engine + Cloud SQL + Cloud Storage
- Azure: App Service + Cosmos DB + Blob Storage

## Performance Optimization

- Video streaming with chunking
- Lazy loading for video lists
- Database indexing on frequently queried fields
- Caching analysis results
- GPU acceleration for CV models (CUDA)

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB service
mongod --version

# Use MongoDB Atlas for cloud database
```

### YOLO Model Download
```bash
# Models auto-download on first use
# Or pre-download:
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

### `npm ci` fails in the Docker image with "Missing: X from lock file"
If your local npm major version differs from the one in `node:20-bookworm-slim` (npm 10 as of writing), `npm install` run locally can produce a `package-lock.json` that your local npm accepts but the container's older npm rejects as incomplete — even though nothing is actually wrong with your dependencies. Check with `npm --version` locally vs. `docker run --rm node:20-bookworm-slim npm --version`. If they differ, regenerate the lockfile using the same npm version the image uses:
```bash
docker run --rm -v "$(pwd)/client:/app" -w /app node:20-bookworm-slim npm install
```
(swap `client` for `server` as needed), then use `npm ci` (not `npm install`) for any further local installs against that lockfile, since `npm install` will silently rewrite it back to your local npm's format.

### Port Already in Use
```bash
# Change ports in .env
# Or kill process using port:
lsof -ti:5000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :5000   # Windows
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue on GitHub
- Check existing documentation
- Review code examples in `/examples`

## Roadmap

**Shipped:**
- [x] Real YOLO player detection + tracking (TrackTrack w/ ReID), replacing the earlier hardcoded mock analysis
- [x] Jersey number OCR + shirt-color classification, with automatic track merging where confident
- [x] Manual player verification UI (thumbnail review, jersey/roster editing, track merging) for the majority of tracks OCR can't identify on its own
- [x] Async analysis pipeline (`202` + background processing + status polling) instead of blocking the request
- [x] Teams & players management dashboard (basic — see gaps below)
- [x] JWT authentication — register/login, bcrypt-hashed passwords, all `/api/videos`, `/api/analysis`, `/api/teams`, `/api/players`, and `/uploads` (video files + thumbnails) routes require a valid Bearer token. Frontend has Login/Register pages, a `ProtectedRoute` wrapper, and an axios interceptor that attaches the token and force-logs-out on 401; native `<video>`/`<img>` tags can't send auth headers, so media is fetched as an authenticated blob via `useAuthedMedia` and handed to the element as an object URL. `/api/health` and `/api/auth/{register,login}` remain open.
- [x] Role-based restrictions — `role: 'admin' | 'scout'` on `User`; the first account ever registered on a fresh install is auto-promoted to admin (there'd otherwise be no way to ever satisfy a role check), every account after that defaults to `scout`. Admins can list users and change roles via `GET/PATCH /api/auth/users`. Deleting a team, player, or video is admin-only (cascades into other data); create/update/read stay open to any authenticated user.
- [x] Input validation — every mutating route (`POST`/`PUT`/`PATCH`) validates its body/params with `express-validator` (email format, password length, Mongo ObjectId shape, jersey-number range, etc.) via a shared `middleware/validate.js`, returning `400` with the specific field error instead of hitting Mongoose and leaking a raw driver error.
- [x] Backend automated tests — `server/tests/` (Jest + Supertest), 31 tests covering registration/login/role-bootstrap, validation rejection, role-gated deletes, and the rate-limit mechanism itself, run against a disposable `scout-bridge-analytics-test` database so they never touch real data. Split `server.js` into `app.js` (the Express app, importable by tests) + a thin `server.js` entrypoint to make this possible.
- [x] Frontend automated tests — React Testing Library, 15 tests covering `AuthContext` (login/register/logout/session-restore/stale-token-logout), `LoginPage`, `RegisterPage`, and `ProtectedRoute`. Mocks `axios`/`useAuth` rather than needing a live server.
- [x] Rate limiting — `/api/auth/login` capped at 10 attempts / 15 min, keyed by IP + submitted email (so one attacker can't lock out a real user's email from a different IP, but a single IP+email pair is capped) via `express-rate-limit`; `/api/auth/register` capped at 20/hour per IP to slow mass fake-account creation. Disabled under `NODE_ENV=test` since the mechanism itself has its own dedicated tests (`server/tests/rateLimit.test.js`) against a throwaway low-limit app rather than fighting the real 15-minute window.
- [x] CI/CD — `.github/workflows/ci.yml` runs on every push/PR: backend test suite (with a real `mongo:6.0` service container), frontend test suite, a production client build, and a Python CV module byte-compile check.
- [x] Docker — `server/Dockerfile` (Node 20 + the full Python CV stack — ultralytics/torch/opencv/easyocr — in a venv, since the analysis pipeline is core functionality) and `client/Dockerfile` (Node 20, runs the CRA dev server, matching `docker-compose.yml`'s bind-mount dev workflow). **Fully verified**: both images build successfully and `docker compose up` was run for real — all three containers (mongo, server, client) started, the server connected to Mongo, and a real register→login round trip succeeded through the published ports, with the reset/verify console-fallback email log visible in `docker logs`. Along the way, found and fixed six real bugs by actually building and running it (not by inspection): (1) missing `.dockerignore` files meant `node_modules` was being uploaded as build context (338MB, 4 min, for nothing); (2) `analysisController.js`'s Python/CV/upload paths were hardcoded relative to a full repo checkout (`__dirname/../..`), which silently breaks in the container (only `server/` is copied in) — now overridable via `PYTHON_BIN`/`CV_DIR`/`TMP_ANALYSIS_DIR`/`UPLOAD_DIR` env vars set in the Dockerfile, local dev's `__dirname` defaults unchanged; (3) `docker-compose.yml` was missing `JWT_SECRET` (and `CLIENT_URL`/`SMTP_*`) entirely — every login/register would have thrown; (4) local npm 11 and the image's npm 10 disagreed about `client/package-lock.json` completeness (npm 10 correctly flagged a real missing `yaml` transitive dependency) — regenerated the lockfile via the same npm version the image uses, documented in Troubleshooting below; (5) `easyocr` transitively depends on `opencv-python-headless`, which shares files with `opencv-python` on Linux — installing both in one pass and then uninstalling one afterward corrupted the surviving `cv2` install entirely (`import cv2` failed), caught by a build-time assertion rather than shipped broken; fixed properly by installing `easyocr` with `pip install --no-deps` (its other real dependencies are listed explicitly in `requirements.txt`) so `opencv-python-headless` is never resolved at all; (6) pip's default resolver picked torch's CUDA build (multi-GB, including a full cuDNN/cuBLAS/cuFFT toolkit) despite nothing in this codebase requesting a CUDA device — fixed by installing the CPU-only build from PyTorch's own wheel index before the main `requirements.txt` install; confirmed in the build log (`torch 2.5.1+cpu - CUDA build: False`).
- [x] Password reset / email verification — `POST /api/auth/forgot-password` (always 200, no account-existence leak, rate-limited to 5/15min per IP+email), `POST /api/auth/reset-password`, `POST /api/auth/verify-email`, `POST /api/auth/resend-verification`. Tokens are single-use, expire (1h reset / 24h verify), and only their SHA-256 hash is ever persisted — the raw token exists only in the URL sent to the user, mirroring how the password itself is never stored in plaintext. `server/utils/email.js` sends via any SMTP provider if `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are set; with no SMTP configured (the state of this environment — no provider credentials exist here), it logs the email to the server console instead of pretending to send it, so the whole flow is still testable end-to-end locally. Frontend: `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`, and an `EmailVerificationBanner` shown app-wide for unverified accounts. 12 backend tests + 4 new frontend test files, all verified against the live server with real tokens end-to-end (not just the test suite).
- [x] `multer` upgraded 1.4.5→2.2.0 — 1.x has four real DoS/crash CVEs (unhandled stream errors, malformed multipart requests, empty field names, unhandled busboy errors) all fixed by 2.x; verified via the public API diff between the two versions that no application code needed to change, then confirmed with a real multipart upload against the live server (201, correct file size) plus the `fileFilter` rejection path.
- [x] Public landing page + redesigned authenticated home — `/` used to be behind the login wall entirely (`ProtectedRoute` around `Home`). It's now a `RootRoute` that renders `LandingPage` (hero, clickable feature tabs, an expandable "how it works" accordion, and a sample report table explicitly labeled "sample data") for signed-out visitors, or the redesigned `Home` (time-of-day greeting, live stat cards linking to Dashboard/Teams/Players, collapsible upload panel, recent-activity feed) for signed-in users — so a visitor can explore what the product does before creating an account. 5 new tests exercise the actual tab-switching and accordion interactions, not just that the page renders.
- [x] Real-time WebSocket streaming — analysis progress is now pushed via Socket.IO (`server/utils/socket.js`) instead of purely polled. The socket handshake requires the same JWT as the REST API (mirrors `requireAuth`); since every video is already visible to every authenticated user via `GET /api/videos`, events broadcast to all connected sockets rather than per-video rooms, matching that existing visibility model instead of inventing a stricter one. `analysisController.js` scrapes the analyzer's existing `"Processed frame X/Y"` stderr log lines to emit `analysis:started`/`analysis:progress`/`analysis:complete`/`analysis:failed`, and throttle-persists progress to `Video.progress` every 10% so it survives a page reload mid-analysis. `VideoList` shows a live `processing (NN%)` badge and only falls back to the old poll loop if the socket is disconnected (the poll interval was also bumped from a 20s timeout — far too short for a real analysis run — to 5 minutes, now that it's a true fallback rather than the primary mechanism). Verified against the live server: unauthenticated sockets are rejected, a real upload→process→complete round trip streamed real progress ticks, and 4 new frontend tests drive the socket events directly. Along the way, found and fixed a real bug: nodemon's default `.json` watch picked up the analyzer's own temp output files in `server/tmp_analysis/`, restarting the server mid-analysis and losing the result — fixed via `server/nodemon.json` ignoring `tmp_analysis/` and `uploads/`.
- [x] Player comparison tools — `GET /api/players/compare?ids=id1,id2,...` aggregates cross-match stats per player (matches played, total/average distance, average speed, sprints, action counts by type, verified-track count) by walking every `Analysis` document that references each player and mapping each track's `trackId` to that analysis's `actions` (actions are keyed by trackId, not the real Player id, so this can't be a single cross-collection query). `PlayersPage` gets a checkbox-based selection UI and a `PlayerComparison` modal with a side-by-side stats table that highlights the best value per row. 5 backend tests (including a real multi-analysis aggregation case) + 7 frontend tests.
- [x] Advanced action recognition — `video_analyzer.py` now populates `pass`/`tackle`/`interception`, not just `shot`. When ball possession transfers between two tracked players, it's classified as a **pass** if both share a shirt color (same team), otherwise a **tackle** if the two were within a close pixel radius at the moment of transfer (a physical challenge) or an **interception** if not (a misplaced pass read from a distance) — reusing the shirt-color voting already computed for track merging rather than adding a separate classifier. `AnalysisPage` shows a per-type count breakdown. Verified with two real end-to-end analysis runs against live footage (not just code review): one produced 11 shots/2 passes/3 interceptions, another 17 shots/3 passes/5 interceptions.
- [x] Multi-sport support — `SPORT_PRESETS` in `video_analyzer.py` defines a real-world field length and ball HSV color range per sport (soccer/basketball/hockey/rugby); soccer's values are the original, footage-tuned defaults, left unchanged. Pixels-per-meter is now derived at runtime as `frame_width / field_length_m` instead of a flat constant that assumed a 1280px-wide frame, so distance/speed accuracy no longer silently degrades on other resolutions either. `Video.sport` (enum, default `soccer`) is set at upload time via a new selector in `VideoUpload`, validated on the upload route, and threaded through to the analyzer via a new `--sport` CLI flag. Verified two ways: running the same footage through both `soccer` and `basketball` presets produced distance values in an exact 3.75x ratio, matching the two presets' field-length ratio (105m/28m) precisely; and a real upload→process run through the live API with `sport: basketball` produced correctly-scaled distances end-to-end. 4 new backend tests cover the validation/default behavior.

**Known gaps (no work started):**
- [ ] Nothing security-related from the original gap list remains untouched — see Larger feature gaps below for what's left, which is product functionality rather than hardening.

**Larger feature gaps:**
- [ ] Cloud storage integration (uploads are local-disk only via Multer)
- [ ] Mobile app
- [ ] Advanced ML models (pose estimation, tactical/formation analysis) — `OPENPOSE_MODEL_PATH` is in `.env` but OpenPose was never integrated

## Acknowledgments

- YOLO & TrackTrack by Ultralytics
- EasyOCR by JaidedAI
- MERN Stack resources
