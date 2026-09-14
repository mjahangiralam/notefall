# Multi-Instrument Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-track automatic/manual instrument playback with a wide General MIDI Soundfont palette while preserving Notefall's premium piano and realtime/offline parity.

**Architecture:** Extend parsed track metadata and settings, resolve each track to a serialisable instrument id, and route notes through a shared lazy `InstrumentRack`. Realtime playback and offline export both use the same rack and resolver.

**Tech Stack:** TypeScript, React, Zustand, `@tonejs/midi`, `smplr`, Web Audio API, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-14-multi-instrument-audio-design.md`

## Global Constraints

- Work only on `moonlit-reverie-video`; do not modify `master`.
- Do not add a second audio dependency.
- Preserve the existing premium Salamander piano path.
- Load only instruments needed by the current song.
- Keep existing single-track/single-piano projects working.
- Instrument assignments must be serialisable and undoable through existing Settings behavior.

---

### Task 1: Track metadata and instrument resolution

**Files:**
- Modify: `src/midi/types.ts`
- Modify: `src/midi/parse.ts`
- Create: `src/audio/instrumentCatalog.ts`
- Create: `tests/instrumentCatalog.test.mjs`

**Interfaces:**
- Produces `TrackInfo.channel`, `program`, `instrumentName`, `instrumentFamily`, `percussion`.
- Produces `InstrumentId`, `resolveTrackInstrument`, `instrumentPickerGroups`, and `requiredInstrumentIds`.

- [ ] Write failing tests asserting program 0 resolves to `notefall-grand`, program 40/41-family string resolves to a string instrument Soundfont id, explicit overrides win, unknown metadata falls back to `notefall-grand`, and required ids deduplicate.
- [ ] Run `npm test` and verify the new test fails because `instrumentCatalog.ts` does not exist.
- [ ] Extend `TrackInfo` with program/channel/instrument metadata and populate it from `@tonejs/midi` track metadata.
- [ ] Implement the 128-program GM catalog and pure resolver.
- [ ] Run `npm test` and verify the catalog tests pass.
- [ ] Commit the task.

### Task 2: Persist per-track instrument overrides and expose the picker

**Files:**
- Modify: `src/store.ts`
- Modify: `src/ui/Inspector.tsx`

**Interfaces:**
- Adds `Settings.trackInstruments: Record<string, string>` with default `{}`.
- Inspector writes explicit per-track ids; missing entry means Auto.

- [ ] Add `trackInstruments` to `Settings` and `defaultSettings`.
- [ ] Add an Instrument select under each note-bearing track in `TrackColorRows`, using grouped catalog options flattened into readable labels for the existing `SelectRow`.
- [ ] Provide `Auto (from MIDI)` and `Notefall Grand Piano` at the top of every track selector.
- [ ] Reset removes the explicit map key so the track returns to Auto.
- [ ] Run `npm run typecheck`.
- [ ] Commit the task.

### Task 3: Shared lazy InstrumentRack

**Files:**
- Create: `src/audio/instrumentRack.ts`
- Modify: `src/audio/sampler.ts` only if a small adapter/export is required.
- Create: `tests/instrumentRackPlan.test.mjs` for pure track-to-required-id planning logic if needed.

**Interfaces:**
- Produces `createInstrumentRack(context?, options?)` returning the rack interface from the spec.
- `prepare(song, assignments, onProgress?)` resolves/deduplicates tracks and lazy-loads only needed instrument backends.
- `start(track, midi, velocity, atAudioTime?, stopId?)` routes to the selected backend; undefined track routes to premium piano.

- [ ] Write a failing pure test for rack preparation planning: two violin tracks load one violin backend, piano + violin load two backends, and undefined/live route uses `notefall-grand`.
- [ ] Run tests and verify red.
- [ ] Implement planning/resolution separately from Web Audio creation.
- [ ] Implement premium piano backend by reusing `createPiano`.
- [ ] Implement Soundfont backend with `smplr` `Soundfont`, `FluidR3_GM`, shared destination/gain, and lazy `ready/load` compatibility for the installed 0.20 API.
- [ ] Fan global volume/expression/detune controls across active backends; retain Salamander-specific EQ/reverb controls on premium piano and keep Soundfont routing stable.
- [ ] Run tests and typecheck.
- [ ] Commit the task.

### Task 4: Realtime AudioEngine routing

**Files:**
- Modify: `src/audio/engine.ts`
- Modify the existing settings-to-engine sync file if instrument settings are propagated there.

**Interfaces:**
- Replace the engine's single sampler routing for song notes with `rack.start(n.track, ...)`.
- Live notes and preview notes call `rack.start(undefined, ...)` and therefore stay on Notefall Grand.
- Add `setTrackInstruments(assignments)` and prepare against the currently loaded song.

- [ ] Change engine initialization to construct the rack and preserve all current global audio setters.
- [ ] On song load/update, prepare the rack for the song's resolved instrument set.
- [ ] Route seek retriggers and normal note-ons by `n.track`.
- [ ] Preserve stop functions, pedal behavior, speed automation, transpose, key events, and silent export playback behavior.
- [ ] Run `npm test` and `npm run typecheck`.
- [ ] Commit the task.

### Task 5: Offline audio/video parity

**Files:**
- Modify: `src/export/renderAudio.ts`

**Interfaces:**
- Offline render creates the same rack on `OfflineAudioContext`.
- Every scheduled song note routes by `n.track` and `settings.trackInstruments`.

- [ ] Replace the single `createPiano` construction with `createInstrumentRack` and `prepare(song, settings.trackInstruments, progress)`.
- [ ] Route note scheduling through `rack.start(n.track, ...)` while preserving pedal ranges, expression, velocity curve, trim, speed automation, user-audio mixing, abort behavior and render tail.
- [ ] Dispose the rack on completion/error.
- [ ] Run typecheck and build.
- [ ] Commit the task.

### Task 6: Full verification

**Files:**
- No production changes unless verification finds a defect.

- [ ] Run `npm test` and record pass/fail count.
- [ ] Run `npm run typecheck` and require exit 0.
- [ ] Run `npm run build` and require exit 0.
- [ ] Verify GitHub Actions for the final branch head completes successfully.
- [ ] Review the final diff to ensure `master` is untouched and no unrelated generated files were committed.
