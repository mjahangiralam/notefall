# SF2 Drum and General MIDI SoundFont Support Design

Date: 2026-09-15
Branch: `moonlit-reverie-video`

## Goal

Give Notefall a proper General MIDI drum backend so channel-10/percussion tracks play with real GM drum-kit mappings instead of being collapsed to the current TR-808 approximation. Preserve the existing premium Notefall grand-piano path and the current per-track instrument routing, realtime playback, and offline export behavior.

The preferred bank is GeneralUser GS 2.0.3 because it is GM/GS compatible, compact for a full bank, and includes multiple drum kits. The first guaranteed scope is percussion. Melodic GeneralUser presets may also be enabled where compatibility tests show that `smplr`'s SF2 parser/player reproduces them correctly; otherwise the existing FluidR3/MusyngKite melodic path remains the fallback.

## Why this change

`src/audio/instrumentRack.ts` already routes note tracks by resolved instrument id, but percussion currently resolves to `drum:TR-808` and converts GM percussion pitches to a small set of drum-machine names. That loses important distinctions such as orchestral cymbals, multiple toms, side stick, tambourine, triangle, and other GM channel-10 notes.

A SoundFont 2 bank can preserve native GM note numbers. This also means imported MIDI files and Notefall exports can share the same drum identity without maintaining a hand-written pitch-to-drum-name translation table.

## Architecture

### 1. New SF2 backend

Add an isolated `src/audio/sf2Bank.ts` module responsible for:

- loading one `.sf2` bank through `smplr`'s `Soundfont2` player;
- constructing the parser through the `soundfont2` package;
- exposing the bank's available preset/instrument names;
- loading the selected GM drum preset;
- starting notes by raw MIDI number and velocity;
- waiting for readiness and reporting failure cleanly;
- disconnecting/disposing without leaking Web Audio nodes.

The module hides `smplr`/`soundfont2` version-specific API details from `instrumentRack.ts`.

### 2. Drum routing

Keep the public instrument id stable at first (`drum:TR-808` may be migrated to a new `drum:gm-sf2` id in a compatibility-safe step), but internally resolve percussion tracks to the SF2 GM drum backend when available.

For SF2 drums:

- pass the original MIDI percussion pitch directly to the sampler;
- do not call `drumNameForMidi`;
- preserve note timing, velocity, stop id, and offline scheduling;
- use the General MIDI Standard/Room/Power kit chosen by the implementation after inspecting the bank's actual preset names.

If SF2 initialization fails, fall back to the existing TR-808 backend rather than to piano. This keeps percussion recognizably percussive even during a network/parser failure.

### 3. Melodic routing

Premium acoustic-grand tracks continue using Notefall's current Salamander piano.

Non-piano melodic tracks continue using the current `smplr Soundfont`/FluidR3 path by default. GeneralUser melodic presets can be enabled only after a small compatibility matrix (strings, brass, bass, flute, harp) passes both realtime and offline-render checks. This avoids changing working orchestral playback merely because the bank is available.

This is intentionally a phased rollout: GM drums are the user-visible requirement; a full GeneralUser melodic migration is optional follow-up behavior behind the same backend boundary.

## Asset delivery and cache

Do not commit a ~30 MB binary SoundFont directly to the Git repository.

Use the project's existing sample-asset hosting pattern (R2/static CDN) and serve the `.sf2` file from a stable, versioned URL. Add the exact GeneralUser version to the asset filename/path so future bank updates do not poison old caches.

Extend the existing successful-response-only sample cache so the SF2 response is cached in Cache Storage after the first successful load. A failed/404 response must never be persisted.

If `Soundfont2` cannot consume the project's `Storage` abstraction directly, fetch the bank through the cache layer, obtain its `ArrayBuffer`, and construct the SoundFont parser from those bytes rather than letting the library fetch independently.

## Loading behavior

The SF2 bank is lazy-loaded only when the prepared song contains a percussion track. Piano-only and non-percussion songs pay no download or parse cost.

`InstrumentRack.prepare()` will include the SF2 drum backend in its existing backend-preparation phase. Playback begins only after required backends are ready, matching current multi-instrument behavior.

Progress reporting should reuse the existing load-status mechanism where practical. Because SF2 is one large response rather than many small samples, byte-level progress is optional; a deterministic loading state is sufficient for the first implementation.

## Realtime and offline parity

The same backend abstraction must work with both `AudioContext` and `OfflineAudioContext`.

`src/export/renderAudio.ts` already creates the shared instrument rack, so the SF2 path must live inside the rack rather than in UI or realtime-only code. The acceptance criterion is that a channel-10 note at a given MIDI pitch resolves to the same drum preset/note during live playback and exported WAV/video audio.

## Instrument selector

The existing per-track instrument selector remains the source of manual overrides.

For percussion tracks:

- `Auto` selects the GM SF2 drum backend;
- the selector may later expose named kits (Standard, Room, Power, Orchestra, etc.) after the bank's real preset names are validated;
- the first implementation does not need a new kit picker unless multiple kit selection is trivial once preset enumeration is working.

No visual/color behavior changes are required.

## Failure behavior

Failures must degrade in this order:

1. requested GeneralUser SF2 drum kit;
2. existing TR-808 drum backend;
3. silence only if both percussion backends fail.

A percussion track must never fall back to the grand piano.

Melodic tracks retain their current fallback to Notefall Grand when a melodic SoundFont fails.

Errors should be logged once per backend initialization failure, not once per note.

## Dependencies

Add the `soundfont2` package required by `smplr`'s `Soundfont2` API if it is not already transitively usable as a direct import. Keep `smplr` unless implementation testing proves that the installed version cannot load GeneralUser GS correctly.

Do not introduce a second unrelated sampler library unless the current `smplr` SF2 path fails the compatibility tests.

## Testing

Add pure/integration tests covering:

- percussion tracks plan the SF2 drum backend;
- melodic/piano routing is unchanged;
- raw GM percussion MIDI pitches pass through unchanged to SF2;
- SF2 failure falls back to TR-808, never piano;
- backend planning still deduplicates multiple percussion tracks;
- songs without percussion do not request/load the SF2 bank;
- offline render uses the same percussion route;
- disposal stops/disconnects the SF2 backend;
- existing instrument catalog, track color, and multi-instrument tests continue to pass.

Run the full existing suite, TypeScript typecheck, and production build in GitHub Actions before completion.

## Compatibility validation

Before enabling GeneralUser melodic presets by default, manually/test-programmatically probe at least:

- acoustic strings;
- brass;
- synth/dark bass;
- flute/woodwind;
- harp;
- one standard drum kit and one orchestral-style drum kit.

GeneralUser GS uses SoundFont 2.01 modulators and warns that incomplete synth implementations can render presets incorrectly. If a preset fails, retain the existing FluidR3/MusyngKite path for that class rather than shipping degraded audio.

## Non-goals

- Replacing the premium Salamander/Notefall piano.
- Rewriting the MIDI parser.
- Changing track colors or visual rendering.
- Bundling the entire SoundFont inside the JavaScript bundle.
- Building a full DAW-style bank/preset manager in this iteration.

## Acceptance criteria

A multi-track MIDI with GM percussion should:

1. automatically identify its percussion track;
2. lazily load the versioned GeneralUser SF2 bank once;
3. play channel-10 notes with their native GM percussion mapping;
4. preserve the same drum behavior in exported audio/video;
5. keep piano and melodic instrument behavior unchanged unless explicitly validated for GeneralUser;
6. fall back to TR-808 if the SF2 path fails;
7. pass the full test/typecheck/build workflow.
