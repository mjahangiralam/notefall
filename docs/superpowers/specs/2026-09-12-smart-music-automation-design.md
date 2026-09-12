# Smart Music Automation Design

## Goal
Add a shared, fully local musical-analysis subsystem to Notefall that can generate three editable automation layers from a loaded MIDI song:

1. Smart Animation Pins
2. Smart Dynamics (MIDI CC11 Expression)
3. Smart Speed (rubato / tempo-feel automation)

The system should work generically across MIDI files while producing musically sensible results for Moonlit Reverie FINAL as a reference case.

## User-facing controls
Add a compact Smart control to the Timeline Editor with four actions:

- Smart All
- Smart Pins
- Smart Dynamics
- Smart Speed

Each action applies immediately and is undoable through Notefall's existing undo system. No confirmation dialog is required.

Smart All runs the analysis once and applies all three automation outputs together so the visual, dynamics, and speed layers remain musically aligned.

## Architecture
Create one pure analysis module that reads `ParsedSong` and returns a reusable musical profile. The profile is then consumed by three independent generators.

Suggested files:

- `src/musicAnalysis/analyzeSong.ts`
- `src/musicAnalysis/smartPins.ts`
- `src/musicAnalysis/smartDynamics.ts`
- `src/musicAnalysis/smartSpeed.ts`
- `src/ui/SmartAutomationMenu.tsx`

The analysis layer must not depend on React, browser APIs, audio state, or rendering code. It should be deterministic and unit-testable.

## Analysis model
The analyzer should inspect the full MIDI song in fixed or adaptive windows and derive normalized features such as:

- note density
- average and upper-percentile velocity
- active pitch range
- register centroid
- polyphony / chord thickness
- onset rate
- rest duration / phrase gaps
- sustain-pedal activity
- existing CC11 expression, when present
- local change rate between adjacent windows

From these features, derive a smoothed musical intensity curve from 0 to 1.

The analyzer should also identify structural events:

- phrase starts
- phrase endings
- significant rests / sparse passages
- local builds
- local releases
- strongest global climax
- secondary climaxes where musically meaningful
- return / resurfacing regions after sparse passages
- coda / terminal fade when the ending clearly reduces intensity

Detected events should include confidence and time so downstream generators can ignore weak detections.

## Smart Dynamics
Smart Dynamics writes `ParsedSong.expressions` using the existing CC11 data model.

Behavior:

- If the song already contains meaningful CC11 data, treat that curve as a strong prior. Smooth and refine it rather than replacing its musical intent.
- If the song has no meaningful CC11, generate a new curve from musical intensity and phrase structure.
- Phrase endings should generally relax.
- Builds should generally crescendo.
- Climaxes should reach the upper part of the range without constantly hitting 100%.
- Sparse / reflective sections should fall meaningfully lower.
- The ending should taper when the analysis identifies a true coda fade.
- Avoid dense automation noise. Prefer a small number of musically meaningful breakpoints.

Recommended practical range for generated values: roughly 0.35 to 1.0, with values outside that range only when strongly justified.

Generated points must be normalized through the existing expression utilities and remain fully editable in the Dynamics lane.

## Smart Speed
Smart Speed generates `settings.midiSpeedAutomation` using existing `SpeedPoint` semantics.

The goal is restrained expressive rubato, not tempo rewriting.

Behavior:

- Slightly accelerate through confident builds.
- Ease back into phrase endings.
- Add a gentle breath around meaningful rests.
- Relax after a major climax.
- Allow slightly more breathing room around a sparse or suspended section.
- Return toward 1.0 before or during a resurfacing theme so the re-entry feels stable.
- The coda may slow modestly if the analysis supports it.

Default generated speeds should usually remain around 0.94x to 1.05x. Stronger deviations should be rare and capped conservatively.

Duration preservation is important. After generating the curve, normalize the automation so the integrated total playback duration stays close to the song's unautomated duration. Target tolerance: within about 1% unless the song already contains explicit speed automation that Smart Speed is refining.

Use curvature sparingly. Most generated segments should stay near linear or use gentle easing.

## Smart Animation Pins
Smart Pins generates visual `settingsKeyframes` using the existing settings-keyframe system.

It must preserve the user's current visual identity rather than imposing the Moonlit color palette.

Behavior:

- Capture the current base visual settings as the styling source.
- Generate approximately 6 to 12 pins for a typical 3 to 5 minute piece.
- Place pins at meaningful structural events rather than fixed intervals.
- Keep a minimum spacing between pins unless a short transition genuinely requires two nearby points.
- Map musical intensity into a restrained visual intensity model affecting a limited set of animatable settings, such as:
  - bloom intensity / radius / threshold
  - note emissive / opacity
  - particle count / opacity / brightness / speed
  - hit-line intensity / wave intensity
  - keyboard brightness / key-glow intensity
  - subtle camera FOV and Z-position changes
  - background brightness modulation derived from the existing background color
- Do not make large hue changes unless the user's base setup already has animated color variation.
- Sparse passages should become quieter visually.
- Climaxes should broaden and brighten.
- A return after a sparse passage should rebuild gradually rather than jump.
- Endings should settle or glow according to the detected coda shape.

The Moonlit Reverie preset remains a separate style preset. Smart Pins is a general structural director.

## Smart All
Smart All runs the analyzer once and produces all three outputs from the same structural profile.

Application order:

1. Analyze song.
2. Generate Smart Dynamics.
3. Generate Smart Speed.
4. Generate Smart Pins using the same profile.
5. Apply song-level and settings-level changes as one user action where practical, or as tightly grouped undoable operations if the current store architecture prevents a single cross-domain undo snapshot.

The generated layers should be internally coherent. For example, a detected climax should not receive a crescendo while Smart Speed simultaneously inserts a large slowdown well before the phrase peak unless that shape is musically justified.

## Existing automation behavior
For manual invocation of an individual Smart action:

- Smart Dynamics replaces/refines the current expression curve.
- Smart Speed replaces/refines the current speed curve.
- Smart Pins replaces/refines the current visual pins.

Undo is the recovery path. No destructive confirmation dialog is needed.

For existing CC11 specifically, preserve musical contour as a strong prior rather than blindly overwriting it.

## Moonlit Reverie FINAL reference behavior
Without any hard-coded timestamps, the analyzer should ideally identify:

- a restrained opening
- gradual development
- the main climax around the middle of the piece
- the sparse "time stops" passage
- the re-emergence / resurfacing after that sparse section
- the fading final reprise / coda

The resurfacing region should be treated as a stabilization event: dynamics rebuild gradually, speed returns near unity, and visual intensity returns progressively.

## Determinism and privacy
The entire feature must be local and deterministic.

- No server calls
- No external AI service
- No cloud model dependency
- Same MIDI + same settings => same Smart output

## Error handling
If a song is extremely short or contains too few notes for meaningful structural analysis:

- Smart Dynamics may produce a simple low-density expression contour or leave a flat curve.
- Smart Speed should stay at unity or generate only minimal phrase-end shaping.
- Smart Pins should use at most a few broad structural pins.

The commands should not throw for empty or degenerate MIDI data.

## Testing
Add deterministic tests for the pure analysis and generation functions.

Minimum coverage:

- empty / tiny song safety
- intensity curve bounds
- phrase-gap detection
- global climax detection
- sparse-passage detection
- dynamics output bounds and point sparsity
- existing CC11 prior preservation
- speed bounds
- speed duration normalization within target tolerance
- pin-count limits
- minimum pin spacing
- generated pins preserve the current visual theme rather than forcing Moonlit colors
- repeatability: identical input produces identical output

The branch is complete only when:

- unit tests pass
- `npm run typecheck` passes
- `npm run build` passes

## Non-goals
Do not add:

- server-side AI
- user accounts
- genre classification UI
- a new tempo-map file format
- automatic MIDI-note rewriting
- automatic harmonic reharmonization
- large camera movement or arcade-style visual effects
- changes to the Moonlit composition itself

## Success criteria
The feature is successful when a user can load a normal expressive piano MIDI, press Smart All, and immediately receive tasteful, editable animation pins, phrase dynamics, and restrained rubato that feel coordinated and musical rather than random or overproduced.
