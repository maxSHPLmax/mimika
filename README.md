# Мимика — facial nerve exercise PWA (MVP)

A home-practice aid for facial nerve rehabilitation. It guides the exercises from the
patient's own program ("Гимнастика для лицевого нерва"), watches the face through the
front camera, and measures whether the weak side moves — including tiny movements
that are easy to miss in a mirror.

Everything runs on the phone. No video or images are stored or sent anywhere; only
numbers are saved (in the browser's local storage on that device).

**Not a medical device.** It does not diagnose. The exercise list is editable in
Settings so it can follow whatever program the rehab specialist sets.

---

## 1. Deploy (GitHub Pages, ~5 minutes)

The iPhone camera only works over HTTPS, so the app needs to be hosted. It's
fully static, so any static host works. GitHub Pages is the simplest:

1. Create a new **public** repository (e.g. `mimika`). Pages on private repos
   needs a paid plan.
2. Upload the contents of this folder to the repo root. Use git; the web uploader
   struggles with the 11 MB `.wasm` files.
   ```bash
   cd mimika
   git init && git add . && git commit -m "Mimika MVP"
   git branch -M main
   git remote add origin https://github.com/<you>/mimika.git
   git push -u origin main
   ```
3. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `/ (root)` → Save.
4. After a minute the app is at `https://<you>.github.io/mimika/`.

Alternatives: Netlify Drop (drag the folder onto app.netlify.com/drop) or Cloudflare Pages.
Both give HTTPS immediately.

## 2. Install on the iPhone

1. Open the URL in **Safari** (not Chrome; iOS only installs web apps from Safari).
2. Share button → **На экран «Домой»** (Add to Home Screen).
3. Open **Мимика** from the home screen. On first start it asks for camera access, so tap **Разрешить**.
4. First session: confirm the side check ("Оранжевые точки — на правой стороне?").
   The preview works like a mirror, so her right side appears on the right of the screen.

After the first load everything is cached and works offline.

**Setup tips for her:** phone on a stand at eye level, ~30–40 cm away, light from the
front (window or lamp behind the phone, not behind her). Voice prompts guide each rep,
so she doesn't need to look at the screen during eye exercises.

## 2b. Backup to Raspberry Pi (recommended)

History is stored in Safari's storage on the phone. Removing the app from the home
screen, or a phone reset, loses it. `pi-server/` contains a small backup server for a
Raspberry Pi with Tailscale. See **pi-server/README.md** for the 3-minute setup.

## 3. Run locally (for development)

```bash
npm run serve        # python3 -m http.server 8080
# open http://localhost:8080 in desktop Chrome/Safari (localhost counts as secure)
npm test             # measurement + session logic tests (Node 18+)
```

To test on the phone from your laptop you need HTTPS. Easiest is to push to Pages.

---

## How the measurement works

- **Face tracking:** MediaPipe Face Landmarker (478 landmarks), running in WebAssembly.
  The library, WASM and model are bundled in `vendor/` and `models/`, so there are no
  CDN dependencies.
- **Head-motion removal:** each frame is aligned to her relaxed-face baseline using
  2D Procrustes on points that don't move with expression (nose bridge, inner eye
  corners, face contour near the ears).
- **Paced reps:** each rep is a relax phase followed by an effort phase. Movement is
  measured relative to the last 2 s of relaxation right before that rep. This keeps
  it robust to drift, fatigue and slow expression changes.
- **Direction matters:** for mouth, brow, nose and cheek, movement is projected onto the
  expected direction. Example: during a smile the healthy side pulls the whole mouth
  sideways. The weak corner being dragged toward the healthy side is not counted as
  weak-side movement.
- **Eyes:** eyelid aperture per eye, reported as % closure.
- **Noise floor:** movement counts only above max(≈0.6 mm, 3 × the jitter measured
  during that rep's rest window).

### Known limitation: model crosstalk (and how it's handled)

MediaPipe is trained on healthy, mostly symmetric faces. When only the healthy side
moves, the model "borrows" some of that movement into the weak side. I measured this
per region by warping only the healthy side of a real face image:

| Region | Crosstalk | Handling |
|---|---|---|
| Mouth corners | ~5% | subtracted (`leak: 0.08`) |
| Eyes | ~9% | subtracted (`leak: 0.1`) |
| Cheeks | 10–25% | subtracted (`leak: 0.25`) |
| Brows | ~18% | subtracted (`leak: 0.2`–`0.3`) |
| Nose | ~65% | subtracted, **and** the nose exercise is marked low-confidence: no % shown |

The correction is deliberately conservative: it prefers missing a faint movement to
reporting recovery that isn't there.

**Read trends, not absolute numbers.** In an end-to-end test (a real face photo with a
synthetic asymmetric smile, fed through Chrome's fake camera), readings were very
consistent rep to rep (47% ± 1%). However, the absolute ratio read higher than the
synthetic truth (~30%), because the model under-measures large movements. Same phone,
same setup, day after day, the trend is meaningful. A single "48%" is approximate.

### What was tested

- `tests/analysis.test.js`: MediaPipe's canonical face mesh with simulated head motion
  (translation, roll, zoom) and landmark jitter. Covers:
  - passive-drag rejection
  - 1.5 mm micro-movement detection
  - no false positives on a still side
  - eye closure accuracy
  - alternating squint
  - synkinesis flag
  - mirrored (left-side) case
  - turned-head rejection
  - crosstalk removal
- `tests/runner.test.js`: session state machine, including:
  - live "spark" on weak-side movement
  - fatigue early-stop
  - "hold the healthy side" cue
  - 30% dropped frames
  - guided exercises
- End-to-end in headless Chromium with a fake camera. This covers the full flow, face
  tracking, side check, baseline, measured reps, live bars, summary, history and
  settings. It also confirmed the analysis works down to ~4 fps (headless, no GPU);
  an iPhone runs ~30 fps.

Not yet tested: a real iPhone. Please check the first sessions with her.

---

## Privacy note: MediaPipe telemetry is patched out

MediaPipe Tasks Vision 1.0 sends usage logs to `odml.pa.googleapis.com` every 60 s.
These are not images, but it breaks "nothing leaves the phone", so the bundled
`vendor/mediapipe/vision_bundle.mjs` is patched:
- the logger's `flush()` returns immediately
- the 60 s timer is removed

**If you update MediaPipe, reapply this patch.** Search the bundle for
`odml.pa.googleapis`. The only other outgoing request is Google Fonts, for the Onest
typeface. To remove it, self-host the font or delete the `<link>` tags, and the
system font is used instead.

## Safety guardrails built in (from her guide)

- **Check-in before each session:** twitching or strong tension → the guide's advice
  to rest 1–2 days. A rest-day banner shows on the home screen for 48 h.
- **Session limits:**
  - 4–6 reps per exercise (setting)
  - a calm tempo
  - a 15-minute session cap
  - a note after 3 sessions in a day
- **Fatigue:** if the last reps are clearly weaker than the first ones, the exercise
  ends early ("как только мышцы устают — прекращайте").
- **"Hold the healthy side" cue:** shown when the healthy side overpowers the weak one
  during brow raise and smile.
- **Synkinesis watch:** eye narrowing on the weak side during mouth movements is noted
  gently in the result and the report, as "worth showing to the rehab specialist".
  It is not expected this early, but useful to track over months.

## Project structure

```
index.html              all screens (Russian UI)
css/app.css             styles
js/app.js               navigation, camera setup, session flow, summary, history, settings
js/tracker.js           camera + MediaPipe loop (GPU → CPU fallback)
js/geometry.js          Procrustes alignment, face coordinate frame, framing checks
js/features.js          per-frame features (side positions, eye apertures)
js/analysis.js          rep analysis, crosstalk correction, summaries, Russian feedback text
js/session.js           paced rep state machine (relax → effort)
js/exercises.js         the 10 exercises from her guide, landmark groups, leak coefficients
js/storage.js           local storage (settings, sessions, notes), export
js/sync.js              backup to Raspberry Pi: upload queue, restore/merge, setup code
pi-server/              backup server (Python stdlib) + installer for Raspberry Pi
js/voice.js             Russian speech prompts
sw.js                   offline cache — bump VERSION when you change app files (now mimika-v2)
vendor/mediapipe/       MediaPipe Tasks Vision 1.0.1 (Apache-2.0), telemetry patched
models/                 face_landmarker.task (from google-ai-edge/mediapipe-samples, Apache-2.0)
tests/                  Node tests + MediaPipe canonical face mesh
```

## Next steps (from the plan)

- **Phase 2:** per-exercise trend charts, a weekly standardized assessment set, a
  JSON import to restore backups.
- **Phase 3:** Claude summaries + a weekly PDF report for the physio. This needs a tiny
  backend to hold the API key, since the key must not live in the PWA. Send only the
  numbers from `exportAll()`, never images.
- Later: synkinesis trends, and hand detection to auto-flag assisted reps (currently a
  manual toggle).
