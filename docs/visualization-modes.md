# Visualization modes (Moonlit branch)

NoteFall has three visual modes, selected from the upper-right control inside the video viewport. The selection is stored in the project's settings and saved in `.nfz` files. The existing Piano mode is the default and retains its editing, settings pins, and falling notes.

- **Piano:** original editable piano roll and keyboard. Use this mode to move, add, or remove MIDI notes.
- **Sheet Music:** four-measure scrolling, grand-staff approximation rendered into the same WebGL canvas via `CanvasTexture`. The selected measure and sounding notes are highlighted. The original MIDI timestamps are rounded to an eighth-note horizontal timing grid; durations are represented by approximate whole, half, quarter, and flagged eighth note heads/stems. Notes are placed on treble/bass staves by pitch. An initial MIDI tempo and meter are read when the MIDI is imported, with 120 BPM and 4/4 as defaults. This is a **preview transcription**, not a publish-ready engraving system: later tempo/meter changes, tuplets, enharmonic spelling, rests, voice-leading and sophisticated beaming aren't engraved; only the first eight tracks are shown in 3D mode. Percussion is summarized on the score rather than engraved as pitched notes.
- **3D Space:** original procedural instrument models on a circular stage. Up to eight nonempty MIDI tracks are assigned an instrument family from track metadata and pulse when notes are struck. Left-drag the canvas to orbit; scroll to zoom. The camera also slowly orbits with playback and export time.

**Export:** Both added modes render inside the existing R3F Canvas, not in an HTML overlay. The existing MP4 exporter advances the canvas once per video frame, which updates both score textures and instrument animations. The mode chooser itself does not appear in the video. The existing offline audio routing and piano visualizer remain unchanged.

**Premium drums:** the soundbank uses the Tone-compatible SpessaSynth `audioNodeCreators.worklet` override added in commit `87f707b`. A successful load logs `[NoteFall drums] Premium Drum Collection ready:`; load failures are logged and fall back to TR-808. Browser listening and MP4 playback still require a manual smoke test.

**Testing:** `npm ci && npm test && npm run typecheck && npm run build` from the repository root. GitHub Actions are not needed.
