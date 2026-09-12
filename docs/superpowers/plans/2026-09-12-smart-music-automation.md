# Smart Music Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, fully local Smart Pins, Smart Dynamics, Smart Speed, and Smart All commands that analyze a loaded MIDI once and produce coordinated editable automation.

**Architecture:** A pure `musicAnalysis` layer derives windowed musical intensity plus structural events from `ParsedSong`. Three pure generators consume the shared `SongAnalysis` and return existing Notefall data types: `ExpressionPoint[]`, `SpeedPoint[]`, and `SettingsKeyframe[]`. A compact Timeline Editor menu applies individual outputs or Smart All through existing song/settings undoable edit paths.

**Tech Stack:** TypeScript, React 18, Zustand, Node built-in test runner, existing Notefall MIDI/automation utilities.

**Spec:** `docs/superpowers/specs/2026-09-12-smart-music-automation-design.md`

## Global Constraints

- Entirely local and deterministic: no network, cloud model, or server dependency.
- Do not rewrite MIDI notes, reharmonize, or alter the Moonlit composition.
- Smart Dynamics uses existing CC11 storage in `ParsedSong.expressions`.
- Smart Speed uses existing `Settings.midiSpeedAutomation` / `SpeedPoint` semantics.
- Smart Pins uses existing `Settings.settingsKeyframes` / `SettingsKeyframe` semantics.
- Existing CC11 is a strong prior rather than being discarded.
- Typical Smart Speed values remain approximately 0.94x–1.05x and total duration remains within 1% of unity when generating from scratch.
- Smart Pins preserve the current visual theme and generate roughly 6–12 meaningful pins for a normal 3–5 minute song.
- No confirmation dialogs; Undo is the recovery path.
- Completion requires unit tests, `npm run typecheck`, and `npm run build` to pass.

---

### Task 1: Shared Musical Analyzer

**Files:**
- Create: `src/musicAnalysis/analyzeSong.ts`
- Create: `tests/smartMusicAnalysis.test.mjs`

**Interfaces:**
- Consumes: `ParsedSong` from `src/midi/types.ts`.
- Produces:
  ```ts
  export type MusicalEventKind =
    | 'phrase-start'
    | 'phrase-end'
    | 'sparse'
    | 'build'
    | 'release'
    | 'climax'
    | 'resurface'
    | 'coda'

  export type AnalysisWindow = {
    time: number
    endTime: number
    intensity: number
    density: number
    velocity: number
    register: number
    polyphony: number
    pedal: number
    restBefore: number
  }

  export type MusicalEvent = {
    kind: MusicalEventKind
    time: number
    confidence: number
    intensity: number
  }

  export type SongAnalysis = {
    duration: number
    windowSec: number
    windows: AnalysisWindow[]
    events: MusicalEvent[]
    climaxTime: number | null
  }

  export function analyzeSong(song: ParsedSong): SongAnalysis
  ```

- [ ] **Step 1: Write failing analyzer tests**

Add synthetic-song tests that verify: empty-song safety, all intensity values stay in `[0,1]`, a deliberate two-second note gap produces a phrase boundary/sparse event, and a dense loud middle region is detected as the strongest climax.

- [ ] **Step 2: Run tests and verify red**

Run: `npm test`
Expected: FAIL because `src/musicAnalysis/analyzeSong.ts` does not exist.

- [ ] **Step 3: Implement deterministic window analysis**

Use adaptive windows clamped to `0.75..2.0` seconds, with a target of roughly 120 windows for long songs. For each window derive note onset density, velocity mean plus upper-percentile signal, pitch/register centroid, overlap-based polyphony estimate, pedal occupancy, and rest-before duration. Normalize each feature over the song with robust min/max behavior for constant inputs. Build raw intensity primarily from density, velocity, polyphony, and register breadth, then smooth with a symmetric five-window kernel.

Detect structural events from local intensity slope and rests. Pick the global maximum after smoothing as `climax`. Mark a `resurface` when intensity rises materially after a confidently sparse region. Mark `coda` only in the final 20% when the smoothed ending trend is substantially downward.

- [ ] **Step 4: Run tests and verify green**

Run: `npm test`
Expected: analyzer tests PASS along with existing tests.

- [ ] **Step 5: Commit analyzer**

Commit message: `feat: add deterministic song analysis`

---

### Task 2: Smart Dynamics Generator

**Files:**
- Create: `src/musicAnalysis/smartDynamics.ts`
- Extend: `tests/smartMusicAnalysis.test.mjs`

**Interfaces:**
- Consumes: `SongAnalysis`, `ParsedSong.expressions`, `expressionAt`, `normalizeExpressionPoints`.
- Produces:
  ```ts
  export function generateSmartDynamics(
    song: ParsedSong,
    analysis: SongAnalysis,
  ): ExpressionPoint[]
  ```

- [ ] **Step 1: Add failing dynamics tests**

Verify generated points are deterministic, values stay in `0.35..1.0` for ordinary synthetic input, output is sparse (no more than ~18 points for a four-minute reference), a detected climax is louder than a sparse passage, and an existing CC11 contour materially influences the generated contour.

- [ ] **Step 2: Run tests and verify red**

Run: `npm test`
Expected: FAIL because `generateSmartDynamics` is missing.

- [ ] **Step 3: Implement dynamics generation**

Select candidate times from song start/end plus confident phrase/build/climax/sparse/resurface/coda events. Convert analysis intensity to a restrained expression target around `0.42 + 0.53 * intensity`; bias phrase endings down, builds/climaxes up, sparse events down, resurface events into gradual recovery, and coda down. If CC11 exists, blend approximately 65% existing contour / 35% generated contour at candidate times, preserving the authored musical shape. Remove near-redundant points whose value differs by less than ~0.025 and whose omission keeps interpolation musically equivalent.

- [ ] **Step 4: Run tests and verify green**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit dynamics generator**

Commit message: `feat: add smart dynamics generator`

---

### Task 3: Smart Speed Generator

**Files:**
- Create: `src/musicAnalysis/smartSpeed.ts`
- Extend: `tests/smartMusicAnalysis.test.mjs`

**Interfaces:**
- Consumes: `SongAnalysis`, `SpeedPoint`, `buildSpeedMap`, `midiToTimeline`.
- Produces:
  ```ts
  export function generateSmartSpeed(
    song: ParsedSong,
    analysis: SongAnalysis,
    existing?: readonly SpeedPoint[],
  ): SpeedPoint[]
  ```

- [ ] **Step 1: Add failing speed tests**

Verify generated speeds remain inside `0.94..1.05` for normal synthetic input, a phrase ending is not accelerated relative to the preceding build, resurfacing returns near `1.0`, output is sparse, deterministic, and the total automated duration is within 1% of the original duration.

- [ ] **Step 2: Run tests and verify red**

Run: `npm test`
Expected: FAIL because `generateSmartSpeed` is missing.

- [ ] **Step 3: Implement restrained rubato**

Generate candidate points from the same structural events. Typical targets: build `1.01..1.04`, phrase end `0.96..0.99`, meaningful rest/sparse `0.95..0.98`, climax around `0.99..1.02` depending on incoming build, release `0.97..1.0`, resurface `0.995..1.01`, coda `0.94..0.98`. Use curvature only in `[-0.25, 0.25]`.

Normalize all generated speed values by a single multiplier found through deterministic binary search so `midiToTimeline(buildSpeedMap(points), song.duration)` remains within 1% of `song.duration`, while retaining hard bounds. When refining an existing curve, blend gently rather than erasing pronounced authored rubato.

- [ ] **Step 4: Run tests and verify green**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit speed generator**

Commit message: `feat: add smart speed generator`

---

### Task 4: Smart Animation Pins Generator

**Files:**
- Create: `src/musicAnalysis/smartPins.ts`
- Extend: `tests/smartMusicAnalysis.test.mjs`

**Interfaces:**
- Consumes: `SongAnalysis`, current `Settings`, `SettingsKeyframe`, `pickAnimatable`.
- Produces:
  ```ts
  export function generateSmartPins(
    analysis: SongAnalysis,
    base: Settings,
  ): SettingsKeyframe[]
  ```

- [ ] **Step 1: Add failing pin tests**

Verify normal songs produce 6–12 pins, adjacent generated pins are normally at least 4 seconds apart, pins are deterministic, a climax has stronger bloom/glow than a sparse section, and color settings remain derived from the input theme rather than becoming Moonlit blue.

- [ ] **Step 2: Run tests and verify red**

Run: `npm test`
Expected: FAIL because `generateSmartPins` is missing.

- [ ] **Step 3: Implement structural visual mapping**

Choose start/end plus strongest structural events, score by confidence/significance, enforce minimum spacing, and cap to 12. Start from `pickAnimatable(base)` and modify only restrained continuous settings: `bloomIntensity`, `bloomRadius`, `bloomThreshold`, `noteEmissive`, `noteOpacity`, particle intensity/count/speed, hit-line intensity/wave, keyboard brightness, key-glow intensity, `cameraFov`, camera Z, and background brightness. Do not replace hue; adjust the existing background color in HSL/lightness while retaining its hue/saturation. Sparse passages reduce intensity, climaxes broaden/brighten, resurfacing ramps back gradually, and coda settles.

- [ ] **Step 4: Run tests and verify green**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit pins generator**

Commit message: `feat: add smart animation pins generator`

---

### Task 5: Smart Commands and Timeline UI

**Files:**
- Create: `src/musicAnalysis/smartAutomation.ts`
- Create: `src/ui/SmartAutomationMenu.tsx`
- Modify: `src/ui/TimelineEditor.tsx`
- Modify: `src/store.ts` only if needed for one grouped cross-domain application helper.
- Extend: `tests/smartMusicAnalysis.test.mjs`

**Interfaces:**
- Produces:
  ```ts
  export type SmartAutomationResult = {
    expressions: ExpressionPoint[]
    speed: SpeedPoint[]
    pins: SettingsKeyframe[]
  }

  export function generateSmartAutomation(
    song: ParsedSong,
    settings: Settings,
  ): SmartAutomationResult
  ```

- [ ] **Step 1: Add failing coordination test**

Verify Smart All calls one analysis and produces all three layers with aligned structural extrema: the global climax time should map to a local dynamics high, a visually strong pin, and no contradictory large slowdown before the peak.

- [ ] **Step 2: Implement pure coordinator**

Call `analyzeSong` once, then the three generators. Keep this function pure so coordination can be tested without React.

- [ ] **Step 3: Implement Timeline Editor Smart menu**

Add a compact `Smart` menu beside the existing Follow control with `Smart All`, `Smart Pins`, `Smart Dynamics`, and `Smart Speed`. Disable when no song is loaded. Each action applies immediately.

Individual actions use existing edit paths. For Smart All, preserve practical undoability by capturing the current song before replacing `expressions`, and capturing current settings before replacing `midiSpeedAutomation` and `settingsKeyframes`; if the current store cannot atomically combine song and settings in one undo entry without broad history refactoring, make it two consecutive undoable domain edits and keep the implementation scoped.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit UI integration**

Commit message: `feat: add smart automation controls`

---

### Task 6: Final Verification and Reference-Case Audit

**Files:**
- Modify only files required by failures discovered during verification.

- [ ] **Step 1: Run complete verification**

Run:
```bash
npm test
npm run typecheck
npm run build
```
Expected: all PASS.

- [ ] **Step 2: Audit branch diff**

Confirm there are no external-service dependencies, no changes to MIDI-note editing semantics, no hard-coded Moonlit timestamps in the generic analyzer, and no unrelated refactors.

- [ ] **Step 3: Reference-case smoke check**

Load/analyze `Moonlit_Reverie_FINAL_master.mid` locally without committing it. Confirm the output has a modest number of pins/dynamics/speed points, identifies the sparse late-middle section and later resurfacing, uses restrained speed bounds, and keeps duration within 1%.

- [ ] **Step 4: Final verification commit if needed**

Commit message: `fix: finalize smart music automation`
