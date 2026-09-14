# Multi-Instrument Audio Design

## Goal

Give every MIDI track in Notefall an independent audible instrument while preserving the existing per-track note colours, premium Salamander piano fallback, realtime/offline parity, and backward compatibility.

## User experience

- MIDI tracks keep their current per-track colour controls.
- Each note-bearing MIDI track also gets an **Instrument** selector in Inspector → Notes.
- Default selection is **Auto (from MIDI)**.
- Auto reads the MIDI track's General MIDI program/instrument metadata.
- Users may override any track with:
  - **Notefall Grand Piano** (existing Salamander samples), or
  - any supported General MIDI Soundfont instrument exposed by the local catalog.
- A missing/unknown MIDI program falls back to Notefall Grand Piano.
- Existing projects without instrument assignments continue to sound exactly as piano-only projects until Auto can resolve a non-piano MIDI program.
- Only instruments actually needed by the loaded song are loaded.
- Realtime playback and exported audio/video must use the same instrument assignments.

## Instrument model

`TrackInfo` is extended with MIDI metadata:

```ts
export type TrackInfo = {
  name: string
  hasNotes: boolean
  channel: number | null
  program: number | null
  instrumentName: string | null
  instrumentFamily: string | null
  percussion: boolean
}
```

Settings add a serialisable per-track override map:

```ts
trackInstruments: Record<string, string>
```

Assignment ids:

- `auto` — resolve from MIDI metadata.
- `notefall-grand` — current Salamander Grand Piano.
- `soundfont:<name>` — General MIDI Soundfont instrument.

The UI stores only explicit overrides. Missing entries are treated as `auto`.

## Catalog and automatic mapping

Create a pure `audio/instrumentCatalog.ts` module. It contains:

- the 128 General MIDI program names in program-number order,
- conversion from GM display names to `smplr` Soundfont ids,
- grouped picker options (Piano, Chromatic Percussion, Organ, Guitar, Bass, Strings, Ensemble, Brass, Reed, Pipe, Synth Lead, Synth Pad, Synth Effects, Ethnic, Percussive, Sound Effects),
- `resolveTrackInstrument(trackInfo, override)`.

Program 0 (Acoustic Grand Piano) resolves to `notefall-grand` so existing piano MIDIs keep the current premium sampler. Other valid programs resolve to `soundfont:<gm-id>`.

Percussion tracks are not sent through a pitched GM instrument. In this first implementation they fall back to `soundfont:synth_drum` unless manually overridden; a dedicated channel-10 drum-kit mapper can be added later without changing the rack interface.

## Audio architecture

Create `audio/instrumentRack.ts` as the common abstraction used by realtime and offline rendering.

The rack owns:

- one lazily-created Salamander piano instance when any track resolves to `notefall-grand`,
- one lazily-created `smplr` Soundfont instance per distinct `soundfont:<name>` assignment,
- a track-index → resolved instrument-id table,
- per-note start routing by track,
- global settings fan-out for volume, expression, reverb, release, detune and EQ where supported.

Public shape:

```ts
export type TrackInstrumentAssignment = Record<string, string>

export type InstrumentRack = {
  readonly context: BaseAudioContext
  prepare(song: ParsedSong, assignments: TrackInstrumentAssignment, onProgress?: (p: LoadProgress) => void): Promise<void>
  start(track: number | undefined, midi: number, velocity: number, atAudioTime?: number, stopId?: string): StopFn
  stopAll(): void
  setVolume(value: number): void
  setExpression(value: number): void
  scheduleExpression(points: readonly { time: number; value: number }[]): void
  setReverbDry(level: number): void
  setReverbWet(level: number): void
  setReverbSize(seconds: number): void
  setReverbDecayTime(seconds: number): void
  setReverbDecay(decay: number): void
  setReverbPreDelay(seconds: number): void
  setReverbDamping(amount: number): void
  setReverbHiCut(hz: number): void
  setReverbLowCut(hz: number): void
  setReleaseTime(seconds: number): void
  setDetune(cents: number): void
  setEqBand(index: number, db: number): void
  setVelocityCompensation(compensation: number): void
  dispose(): void
}
```

The existing Salamander implementation remains the high-quality piano backend. Soundfont instruments are routed through the same Web Audio destination and receive the rack's master volume/expression. Effects that are specific to the Salamander chain may be approximated or no-op on Soundfont voices in v1; playback/export instrument identity is the hard requirement.

## Realtime engine

`AudioEngine` replaces its single `piano` field with an `InstrumentRack`.

- `loadSong` / settings sync gives the rack the loaded song and current `trackInstruments` assignments.
- Song note-on uses `rack.start(n.track, ...)`.
- Live keyboard/MIDI input and editor previews use the premium piano route (`track` undefined → `notefall-grand`).
- Changing a track instrument stops currently sounding MIDI voices, rebuilds only required rack instruments, and resumes subsequent notes with the new sound. It must not mutate MIDI note data.

## Offline export

`renderSongAudio` creates the same rack against `OfflineAudioContext`, prepares it from `song + settings.trackInstruments`, and schedules each note with `rack.start(n.track, ...)`.

This preserves export parity: if Track 2 is cello in preview, it is cello in exported WAV/MP4 audio.

## Persistence and compatibility

- `trackInstruments` lives in `Settings`, so it automatically follows existing project persistence, settings undo/redo, and `.nfz` project serialization.
- Default is `{}`.
- Old projects deserialize without the field through the existing settings/default merge path and therefore behave as `auto`.

## Testing

Pure tests cover:

1. GM program → Soundfont id resolution.
2. Program 0 → Notefall Grand.
3. Unknown metadata → Notefall Grand fallback.
4. Explicit override beats Auto.
5. Instrument ids group correctly for UI.
6. Required unique instrument ids are deduplicated across tracks.

Integration confidence is provided by `npm test`, `npm run typecheck`, and `npm run build` in GitHub Actions. Realtime/offline routing is typechecked against the shared rack interface.

## Constraints

- Work only on `moonlit-reverie-video`; do not modify `master`.
- Do not add a second audio dependency.
- Preserve the existing premium Salamander piano path.
- Load only instruments needed by the current song.
- Keep existing single-track/single-piano projects working.
- Instrument assignments must be serialisable and undoable through existing Settings behavior.
