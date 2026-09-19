# NoteFall visualization modes — improved score and instrument stage

Choose **Piano**, **Sheet Music**, or **3D Space** in the top-right of the viewport. The selected mode is stored in the project settings; Piano remains the original editable default.

## Sheet Music

- Each nonempty MIDI track receives its own clearly named score part, in MIDI track order. Unlike a piano reduction, different instruments never share the same staff just because their pitches overlap.
- For a single instrument spanning both hands, the score uses a bracketed grand staff with treble and bass. Mixed-register keyboard, harp, and wide-range polyphonic parts also receive grand staves when appropriate; a normally single-register instrument receives one treble or bass staff.
- Percussion is rendered on its own five-line drum staff with kick/snare/cymbal noteheads, not omitted or folded into a pitched staff.
- Score pages contain up to five staves without splitting an instrument's grand staff; use **PageUp** and **PageDown** to change instrument-part pages. The chosen part page is the one exported in MP4. Two measures are displayed per system, with playback tracking and note highlighting.
- Empty measures receive whole-measure rests. MIDI timing is quantized to sixteenth-beat positions for readability, but noteheads/durations and accidentals are approximate; complex tuplets, rhythmic voices, ties, key changes, lyrics and later meter/tempo changes are not fully engraved. This is *not a substitute for professional score preparation*, and a MIDI file cannot generally recover the original human-written engraving.

## 3D Space

- Original procedurally modeled instruments now have additional physical details (hardware, strings/frets, keybeds, drum shells and heads, bells/valves, reed keys and more), stage lighting, shadows, name labels, orbit camera and note-synchronized pulsing.
- All 128 General MIDI program numbers are classified into 23 recognizable model categories: pianos, electric keyboards, organ, accordion, guitar, bass, violin, cello, harp, brass, woodwinds, bagpipes, mallets, percussion, synthesizer, choir/studio and effects rigs. Unrecognized metadata displays an instrument-style synth rig, **not** a floating music-note placeholder.
- Every nonempty MIDI track is represented; instruments are arranged in concentric groups and scaled for crowded sessions. Hundreds of instruments may tax the GPU, so video preview quality should be checked on large arrangements.
- **Rendering limitation:** these are improved original procedural representations, **not licensed photorealistic GLB models and not 128 individually modeled instruments**. True photo-realism for every orchestra/GM variant requires a properly licensed model collection with an asset attribution and loading pipeline. No third-party copyrighted models were copied from the reference video.

## Audio and export

The existing Premium Drum Collection worklet compatibility change is retained. The 3D models represent MIDI program metadata and do not change audio output. Score and stage are drawn in the same R3F canvas used by the video exporter. The mode selector and score page-switching controls themselves are not rendered into MP4. Edit MIDI notes in Piano mode.

Run local checks: `npm ci && npm test && npm run typecheck && npm run build`. GitHub Actions and Codex are not required. Listen to a drum MIDI and watch a short test export in Chrome to confirm actual audio/video behavior after installation.
