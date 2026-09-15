# SF2 Drum Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GeneralUser GS 2.0.3 as Notefall’s lazy-loaded General MIDI drum backend so channel-10 percussion keeps native GM note mapping in realtime playback and exported audio/video, with TR-808 fallback and no change to piano/melodic defaults.

**Architecture:** Add a focused `src/audio/sf2Bank.ts` adapter around `smplr`’s `Soundfont2` plus the `soundfont2` parser. Fetch the versioned `.sf2` through Notefall’s successful-response-only sample cache, hand `Soundfont2` a temporary blob URL, load a deterministic drum instrument, and expose a narrow raw-MIDI-note API to `instrumentRack.ts`. Change percussion resolution to a stable `drum:gm-sf2` route while retaining `drum:TR-808` as an explicit fallback/manual route. Because realtime and offline export already share `createInstrumentRack`, routing inside the rack gives both paths the same backend automatically.

**Tech Stack:** TypeScript 5.6, Web Audio API / OfflineAudioContext, `smplr` 0.20.x, `soundfont2` 0.5.0, Zustand, Vite 5, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-15-sf2-drum-support-design.md`

## Global Constraints

- GeneralUser GS version is exactly **2.0.3** for this rollout.
- Do **not** commit the ~30 MB `.sf2` binary to Git.
- Production asset path is `https://samples.notefall.app/generaluser-gs-2.0.3/GeneralUser-GS.sf2`.
- Development asset path is `/samples-cdn/generaluser-gs-2.0.3/GeneralUser-GS.sf2`, using the existing Vite CDN proxy.
- Add `soundfont2@0.5.0` as a direct dependency; keep the existing `smplr` dependency.
- Piano tracks keep the premium Notefall/Salamander path.
- Non-piano melodic tracks keep the current FluidR3/MusyngKite `Soundfont` path.
- Percussion fallback order is **GeneralUser SF2 → TR-808 → silence**.
- Percussion must never fall back to Notefall Grand.
- SF2 loading is lazy: songs without a percussion track must not fetch or parse the bank.
- Realtime and offline export must share the same SF2 routing.
- No visual/color behavior changes.

---

### Task 1: Add reproducible GeneralUser asset tooling and parser dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/fetch-generaluser-gs.sh`
- Create: `scripts/upload-generaluser-gs-r2.sh`
- Modify: `.gitignore` only if `public/samples/generaluser-gs-2.0.3/` is not already covered

**Interfaces:**
- Consumes: existing R2 environment variables used by `scripts/upload-r2.sh`.
- Produces: local non-versioned asset at `public/samples/generaluser-gs-2.0.3/GeneralUser-GS.sf2` and production CDN object at `generaluser-gs-2.0.3/GeneralUser-GS.sf2`.

- [ ] **Step 1: Add the direct parser dependency**

Run:

```bash
npm install soundfont2@0.5.0
```

Expected changes:

```json
{
  "dependencies": {
    "soundfont2": "^0.5.0"
  }
}
```

Keep the generated `package-lock.json` change; do not hand-edit lockfile integrity fields.

- [ ] **Step 2: Add a deterministic fetch script**

Create `scripts/fetch-generaluser-gs.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$REPO_ROOT/public/samples/generaluser-gs-2.0.3"
DEST="$DEST_DIR/GeneralUser-GS.sf2"
SOURCE="https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/main/GeneralUser-GS.sf2"

mkdir -p "$DEST_DIR"
curl --fail --location --retry 3 --output "$DEST" "$SOURCE"

size=$(wc -c < "$DEST" | tr -d ' ')
if [ "$size" -lt 25000000 ]; then
  echo "error: GeneralUser-GS.sf2 download is unexpectedly small: $size bytes" >&2
  rm -f "$DEST"
  exit 1
fi

echo ">> GeneralUser GS 2.0.3 downloaded to $DEST ($size bytes)"
```

The size guard rejects HTML/error bodies and obviously incomplete downloads without pinning to an opaque checksum that could accidentally describe a different upstream revision.

- [ ] **Step 3: Add an SF2-specific R2 upload script**

Create `scripts/upload-generaluser-gs-r2.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SF2_FILE="${SF2_FILE:-$REPO_ROOT/public/samples/generaluser-gs-2.0.3/GeneralUser-GS.sf2}"
R2_PREFIX="${R2_PREFIX:-generaluser-gs-2.0.3}"

if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_ROOT/.env"
  set +a
fi

for var in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET; do
  if [ -z "${!var:-}" ]; then
    echo "error: missing env var: $var" >&2
    exit 1
  fi
done

if [ ! -f "$SF2_FILE" ]; then
  echo "error: SF2 file not found: $SF2_FILE" >&2
  echo "       run 'bash scripts/fetch-generaluser-gs.sh' first" >&2
  exit 1
fi

DIR="$(dirname "$SF2_FILE")"
NAME="$(basename "$SF2_FILE")"

docker run --rm \
  -v "$DIR:/data:ro" \
  -e RCLONE_CONFIG_R2_TYPE=s3 \
  -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  -e RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e RCLONE_CONFIG_R2_REGION=auto \
  rclone/rclone:latest \
  copyto "/data/$NAME" "r2:${R2_BUCKET}/${R2_PREFIX}/${NAME}" \
    --header-upload "Cache-Control: public, max-age=31536000, immutable" \
    --header-upload "Content-Type: application/octet-stream" \
    --checksum \
    --progress
```

- [ ] **Step 4: Keep the binary out of Git**

If `.gitignore` does not already cover generated sample assets, add:

```gitignore
/public/samples/generaluser-gs-2.0.3/
```

Run:

```bash
git check-ignore public/samples/generaluser-gs-2.0.3/GeneralUser-GS.sf2
```

Expected: the path is printed.

- [ ] **Step 5: Verify package metadata and scripts**

Run:

```bash
npm install
npm run typecheck
bash -n scripts/fetch-generaluser-gs.sh
bash -n scripts/upload-generaluser-gs-r2.sh
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/fetch-generaluser-gs.sh scripts/upload-generaluser-gs-r2.sh .gitignore
git commit -m "build: add GeneralUser SF2 asset tooling"
```

---

### Task 2: Add a cache-aware SF2 drum-bank adapter

**Files:**
- Create: `src/audio/sf2Bank.ts`
- Create: `tests/sf2Bank.test.mjs`
- Modify: `src/audio/sampleCache.ts`

**Interfaces:**
- Consumes: `createSampleStorage(): Storage` from `src/audio/sampleCache.ts`; `Soundfont2` from `smplr`; `SoundFont2` from `soundfont2`.
- Produces:

```ts
export const GENERALUSER_GS_VERSION = '2.0.3'
export const GENERALUSER_GS_URL: string

export type Sf2DrumBackend = {
  readonly instrumentName: string
  start(midi: number, velocity: number, time?: number, stopId?: string): StopFn
  stop(): void
  dispose(): void
}

export function selectGeneralUserDrumInstrument(names: readonly string[]): string

export async function createGeneralUserDrumBackend(
  context: BaseAudioContext,
  options?: {
    destination?: AudioNode
    scheduler?: Scheduler
    fetchBytes?: (url: string) => Promise<ArrayBuffer>
  },
): Promise<Sf2DrumBackend>
```

- [ ] **Step 1: Write failing pure-selection tests**

Create `tests/sf2Bank.test.mjs` using the repo’s existing TypeScript-transpile test pattern. Cover deterministic preference order:

```js
test('prefers a standard drum kit name', async () => {
  const { selectGeneralUserDrumInstrument } = await loadModule()
  assert.equal(
    selectGeneralUserDrumInstrument(['Power Kit', 'Standard Kit', 'Orchestra Kit']),
    'Standard Kit',
  )
})

test('accepts orchestra kit when standard is unavailable', async () => {
  const { selectGeneralUserDrumInstrument } = await loadModule()
  assert.equal(
    selectGeneralUserDrumInstrument(['Warm Strings', 'Orchestra Kit']),
    'Orchestra Kit',
  )
})

test('rejects a bank without a recognisable drum instrument', async () => {
  const { selectGeneralUserDrumInstrument } = await loadModule()
  assert.throws(
    () => selectGeneralUserDrumInstrument(['Violin', 'Flute']),
    /drum kit/i,
  )
})
```

Selection order is case-insensitive: `standard`, `room`, `power`, `orchestra`, then first name containing `kit` or `drum`.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test tests/sf2Bank.test.mjs
```

Expected: FAIL because `src/audio/sf2Bank.ts` does not exist.

- [ ] **Step 3: Expose a reusable cache-to-bytes helper**

Modify `src/audio/sampleCache.ts`:

```ts
export async function fetchSampleBytes(url: string): Promise<ArrayBuffer> {
  const response = await createSampleStorage().fetch(url)
  if (response.status !== 200) {
    throw new Error(`sample fetch failed: ${url} (${response.status})`)
  }
  return response.arrayBuffer()
}
```

This keeps the existing successful-response-only caching policy as the single source of truth.

- [ ] **Step 4: Implement `sf2Bank.ts`**

Use the current smplr `Soundfont2` contract: it accepts a URL plus `createSoundfont`, exposes `ready`, `instrumentNames`, and `loadInstrument(name)`.

Core implementation shape:

```ts
import { Soundfont2, type Scheduler, type StopFn } from 'smplr'
import { SoundFont2 } from 'soundfont2'
import { fetchSampleBytes } from './sampleCache'

export const GENERALUSER_GS_VERSION = '2.0.3'
export const GENERALUSER_GS_URL =
  (import.meta.env.DEV
    ? '/samples-cdn/generaluser-gs-2.0.3/GeneralUser-GS.sf2'
    : 'https://samples.notefall.app/generaluser-gs-2.0.3/GeneralUser-GS.sf2')

export function selectGeneralUserDrumInstrument(names: readonly string[]): string {
  const preferred = ['standard', 'room', 'power', 'orchestra']
  for (const token of preferred) {
    const hit = names.find((name) => name.toLowerCase().includes(token) && /kit|drum/i.test(name))
    if (hit) return hit
  }
  const fallback = names.find((name) => /kit|drum/i.test(name))
  if (fallback) return fallback
  throw new Error('GeneralUser GS does not expose a recognisable drum kit instrument')
}
```

For loading, fetch bytes through `fetchSampleBytes`, create a Blob URL, build the sampler, await readiness, select/load the drum instrument, then revoke the Blob URL after parsing/loading has completed:

```ts
const bytes = await (options.fetchBytes ?? fetchSampleBytes)(GENERALUSER_GS_URL)
const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
try {
  const sampler = Soundfont2(context as AudioContext, {
    url: blobUrl,
    destination: options.destination,
    createSoundfont: (data) => new SoundFont2(data),
  })
  await sampler.ready
  const instrumentName = selectGeneralUserDrumInstrument(sampler.instrumentNames)
  await sampler.loadInstrument(instrumentName)
  // return adapter around sampler.start/stop/disconnect
} finally {
  URL.revokeObjectURL(blobUrl)
}
```

The adapter’s `start` must pass the original MIDI note unchanged:

```ts
start(midi, velocity, time, stopId) {
  return sampler.start({
    note: midi,
    velocity: Math.max(1, Math.min(127, Math.round(velocity * 127))),
    time,
    stopId,
  })
}
```

`dispose()` must be idempotent and call `sampler.stop()` plus `sampler.disconnect?.()`.

- [ ] **Step 5: Add source-level tests for raw MIDI passthrough and cached fetch**

Extend `tests/sf2Bank.test.mjs` so it asserts the implementation contains no GM-pitch remapping and calls `fetchSampleBytes(GENERALUSER_GS_URL)`. The behavioral adapter test should inject `fetchBytes` and a mocked Soundfont2 construction boundary if needed; do not perform network access in unit tests.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```bash
node --test tests/sf2Bank.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/audio/sf2Bank.ts src/audio/sampleCache.ts tests/sf2Bank.test.mjs
git commit -m "feat: add cache-aware SF2 drum backend"
```

---

### Task 3: Route percussion to GM SF2 with TR-808 fallback

**Files:**
- Modify: `src/audio/instrumentCatalog.ts`
- Modify: `src/audio/instrumentRack.ts`
- Modify: `tests/instrumentCatalog.test.mjs`
- Modify: `tests/instrumentCatalogAliases.test.mjs`
- Create: `tests/sf2DrumRouting.test.mjs`

**Interfaces:**
- Consumes: `createGeneralUserDrumBackend()` and `Sf2DrumBackend` from Task 2.
- Produces: new resolved instrument id `drum:gm-sf2`; `planInstrumentRack()` returns it for percussion tracks; the rack uses SF2 first and TR-808 only on SF2 initialization/playback failure.

- [ ] **Step 1: Write failing catalog tests for the new route**

Update percussion expectations:

```js
test('percussion auto-resolves to the GM SF2 backend', async () => {
  const { resolveTrackInstrument } = await loadCatalog()
  assert.equal(
    resolveTrackInstrument({
      name: 'Drums', hasNotes: true, channel: 9, program: 0,
      instrumentName: null, instrumentFamily: null, percussion: true,
    }),
    'drum:gm-sf2',
  )
})
```

Keep an explicit override test proving `drum:TR-808` remains accepted.

- [ ] **Step 2: Run catalog tests and confirm RED**

Run:

```bash
node --test tests/instrumentCatalog.test.mjs tests/instrumentCatalogAliases.test.mjs
```

Expected: FAIL because percussion still resolves to `drum:TR-808`.

- [ ] **Step 3: Add the new instrument id without exposing extra UI complexity**

In `src/audio/instrumentCatalog.ts`:

```ts
export type InstrumentId =
  | 'auto'
  | 'notefall-grand'
  | 'drum:gm-sf2'
  | 'drum:TR-808'
  | `soundfont:${string}`
```

Accept both drum ids as explicit overrides, but auto-resolve percussion/channel 10 to `drum:gm-sf2`:

```ts
if (track.percussion || track.channel === 9) return 'drum:gm-sf2'
```

Do not add a separate kit picker in this task.

- [ ] **Step 4: Write the failing rack-routing tests**

Create `tests/sf2DrumRouting.test.mjs` to cover these pure/source-observable guarantees:

```js
test('multiple percussion tracks deduplicate to one SF2 backend', async () => {
  const { planInstrumentRack } = await loadRackModule()
  const song = { tracks: [percussionTrack(), percussionTrack()] }
  assert.deepEqual(planInstrumentRack(song, {}), ['drum:gm-sf2'])
})

test('songs without percussion do not plan the SF2 backend', async () => {
  const { planInstrumentRack } = await loadRackModule()
  const planned = planInstrumentRack({ tracks: [pianoTrack(), violinTrack()] }, {})
  assert.equal(planned.includes('drum:gm-sf2'), false)
})
```

Also source-check that the SF2 route does not call `drumNameForMidi` and does not call `grand.start` as its final fallback.

- [ ] **Step 5: Integrate the SF2 backend into `instrumentRack.ts`**

Add state:

```ts
let sf2Drums: Sf2DrumBackend | null = null
let sf2DrumsFailed = false
let sf2DrumFailureLogged = false
```

Rename the current TR-808 variables for clarity:

```ts
let tr808: LegacyDrumMachine | null = null
let tr808Failed = false
```

Implement:

```ts
async function ensureSf2Drums(): Promise<Sf2DrumBackend | null> {
  if (sf2Drums) return sf2Drums
  if (sf2DrumsFailed) return null
  try {
    sf2Drums = await createGeneralUserDrumBackend(ctx, {
      destination: soundfontExpression,
      scheduler: options.scheduler,
    })
    return sf2Drums
  } catch (error) {
    sf2DrumsFailed = true
    if (!sf2DrumFailureLogged) {
      sf2DrumFailureLogged = true
      console.warn('Could not load GeneralUser GS drums; using TR-808 fallback.', error)
    }
    return null
  }
}
```

When preparing `drum:gm-sf2`, always prepare the fallback if SF2 fails:

```ts
if (id === 'drum:gm-sf2') {
  if (!(await ensureSf2Drums())) await ensureTr808(onProgress)
  return
}
```

At note start:

```ts
if (route === 'drum:gm-sf2') {
  if (sf2Drums) return sf2Drums.start(midi, velocity, atAudioTime, stopId)
  if (tr808) {
    return tr808.start({
      note: drumNameForMidi(midi),
      velocity: Math.max(1, Math.min(127, Math.round(velocity * 127))),
      time: atAudioTime,
      stopId,
    })
  }
  return () => {}
}
```

The explicit `drum:TR-808` route continues to use the existing name conversion directly.

Change existing `ensureDrums` failure behavior: **do not call `ensureGrand()`**. Log once, mark failed, return `null`.

- [ ] **Step 6: Update stop/disposal paths**

`stopAll()`:

```ts
sf2Drums?.stop()
tr808?.stop()
```

`dispose()`:

```ts
sf2Drums?.dispose()
try { tr808?.disconnect?.() } catch { /* already disconnected */ }
```

No percussion disposal path may instantiate piano.

- [ ] **Step 7: Run routing tests**

Run:

```bash
node --test \
  tests/instrumentCatalog.test.mjs \
  tests/instrumentCatalogAliases.test.mjs \
  tests/sf2DrumRouting.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/audio/instrumentCatalog.ts src/audio/instrumentRack.ts tests/instrumentCatalog.test.mjs tests/instrumentCatalogAliases.test.mjs tests/sf2DrumRouting.test.mjs
git commit -m "feat: route GM percussion through SF2"
```

---

### Task 4: Prove realtime/offline parity and failure semantics

**Files:**
- Modify: `tests/sf2DrumRouting.test.mjs`
- Modify: `tests/trackInstrumentSettings.test.mjs` only if the accepted explicit instrument-id assertions require it
- Inspect only unless necessary: `src/export/renderAudio.ts`

**Interfaces:**
- Consumes: shared `createInstrumentRack()` used by both the realtime engine and `renderAudio`.
- Produces: regression coverage that exports inherit the same SF2 drum route without a second audio implementation.

- [ ] **Step 1: Add an offline-path source regression test**

Assert `src/export/renderAudio.ts` continues to construct the shared rack and schedules notes with `n.track`:

```js
test('offline rendering uses the shared instrument rack and note track routing', async () => {
  const source = await readFile(new URL('../src/export/renderAudio.ts', import.meta.url), 'utf8')
  assert.match(source, /createInstrumentRack/)
  assert.match(source, /piano\.start\([\s\S]*?n\.track/)
})
```

If the local variable has been renamed from `piano`, match the actual rack identifier instead; the invariant is `rack.start(..., n.track)`.

- [ ] **Step 2: Add fallback-order regression tests**

Test/source-check these invariants:

```js
assert.match(rackSource, /drum:gm-sf2/)
assert.match(rackSource, /ensureSf2Drums/)
assert.match(rackSource, /ensureTr808/)
assert.doesNotMatch(sf2FallbackBlock, /grand\?\.start|ensureGrand/)
```

Add a focused test that `drum:TR-808` remains a valid manual assignment.

- [ ] **Step 3: Add disposal regression coverage**

Assert the SF2 backend’s `dispose()` is called from the rack and that `stopAll()` reaches both percussion backends.

- [ ] **Step 4: Run the full unit suite**

Run:

```bash
npm test
```

Expected: all existing tests plus SF2 tests pass, with no network calls.

- [ ] **Step 5: Commit**

```bash
git add tests/sf2DrumRouting.test.mjs tests/trackInstrumentSettings.test.mjs
git commit -m "test: cover SF2 drum export and fallback parity"
```

---

### Task 5: Deploy the bank, perform browser compatibility probe, and verify production build

**Files:**
- No source changes expected unless the compatibility probe exposes an implementation defect.
- Optional generated local asset only: `public/samples/generaluser-gs-2.0.3/GeneralUser-GS.sf2` (ignored by Git).

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: a deployed, cacheable GeneralUser GS bank and verified end-to-end SF2 drums in realtime plus export.

- [ ] **Step 1: Fetch the GeneralUser bank locally**

Run:

```bash
bash scripts/fetch-generaluser-gs.sh
ls -lh public/samples/generaluser-gs-2.0.3/GeneralUser-GS.sf2
```

Expected: file is roughly 30 MB and is ignored by Git.

- [ ] **Step 2: Upload the versioned bank to the existing R2 bucket**

With the existing R2 credentials loaded:

```bash
bash scripts/upload-generaluser-gs-r2.sh
```

Then verify the exact production object:

```bash
curl --fail --head https://samples.notefall.app/generaluser-gs-2.0.3/GeneralUser-GS.sf2
```

Expected: HTTP 200 and immutable cache headers.

- [ ] **Step 3: Run local browser compatibility probe**

Run:

```bash
npm run dev
```

Open a MIDI containing channel-10 percussion and confirm:

1. the GeneralUser `.sf2` is requested only after a percussion MIDI is loaded;
2. the request is made through `/samples-cdn/...` in development;
3. the first load produces audible kick/snare/tom/cymbal distinctions using native GM pitches;
4. reload uses Cache Storage rather than another full network download;
5. piano remains Notefall Grand;
6. violin/brass/bass/woodwind/harp still use the pre-existing melodic Soundfont route;
7. forcing the SF2 URL to fail still yields TR-808 percussion, never piano.

- [ ] **Step 4: Verify exported audio uses the same kit**

Export a short WAV/video section containing at least GM notes 36 (kick), 38 (snare), 42 (closed hi-hat), 45/47 (toms), and 49 (crash). Compare against realtime playback for instrument identity and timing. The exact timbre may differ only by normal OfflineAudioContext rendering differences; note-to-drum mapping must be the same.

- [ ] **Step 5: Run final automated verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0. Existing Vite chunk-size warnings are non-blocking unless a new SF2-related bundling error appears.

- [ ] **Step 6: Push and verify the branch workflow**

```bash
git status --short
git push origin moonlit-reverie-video
```

Wait for `.github/workflows/moonlit-verify.yml` on the resulting head SHA and require:

- Test: success
- Typecheck: success
- Build: success

- [ ] **Step 7: Final review**

Before completion, inspect the final diff and verify:

```text
- No .sf2 binary is tracked by Git.
- No percussion fallback invokes Notefall Grand.
- Songs without percussion do not load GeneralUser GS.
- Existing premium piano and melodic routing remain unchanged.
- Realtime and offline render both enter SF2 through InstrumentRack.
- TR-808 remains available as fallback/manual override.
```

If all checks pass, commit any test-only corrections needed during the compatibility probe with a focused message; otherwise leave the verified implementation commits unchanged.
