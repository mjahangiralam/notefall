import { readFile, writeFile, unlink } from 'node:fs/promises'

async function patch(path, replacements) {
  let text = await readFile(path, 'utf8')
  for (const [from, to] of replacements) {
    if (!text.includes(from)) {
      throw new Error(`Patch target not found in ${path}: ${from.slice(0, 120)}`)
    }
    text = text.replace(from, to)
  }
  await writeFile(path, text)
}

await patch('src/store.ts', [
  [
    `  trackColors: Record<string, string>\n  noteEmissive: number`,
    `  trackColors: Record<string, string>\n  // Per-track audio instrument overrides keyed by track index. Missing keys\n  // mean Auto (use MIDI program metadata). Kept outside visual keyframes.\n  trackInstruments: Record<string, string>\n  noteEmissive: number`,
  ],
  [
    `  trackColors: {},\n  noteEmissive: 1.0,`,
    `  trackColors: {},\n  trackInstruments: {},\n  noteEmissive: 1.0,`,
  ],
  [
    `  'midiOffsetSec',\n  'midiTrimStartSec',`,
    `  'trackInstruments',\n  'midiOffsetSec',\n  'midiTrimStartSec',`,
  ],
])

await patch('src/audio/instrumentCatalog.ts', [
  [`export type InstrumentId = 'auto' | 'notefall-grand' | \`soundfont:\${string}\``, `export type InstrumentId = 'auto' | 'notefall-grand' | 'drum:TR-808' | \`soundfont:\${string}\``],
  [`['Clavinet', 'clavichord']`, `['Clavinet', 'clavinet']`],
  [`['Synth Strings 1', 'synthstrings_1']`, `['Synth Strings 1', 'synth_strings_1']`],
  [`['Synth Strings 2', 'synthstrings_2']`, `['Synth Strings 2', 'synth_strings_2']`],
  [`['Synth Voice', 'synth_voice']`, `['Synth Voice', 'synth_choir']`],
  [`['Synth Brass 1', 'synthbrass_1']`, `['Synth Brass 1', 'synth_brass_1']`],
  [`['Synth Brass 2', 'synthbrass_2']`, `['Synth Brass 2', 'synth_brass_2']`],
  [`['Lead 8 (bass + lead)', 'lead_8_bass_lead']`, `['Lead 8 (bass + lead)', 'lead_8_bass__lead']`],
  [`['Bag Pipe', 'bag_pipe']`, `['Bag Pipe', 'bagpipe']`],
  [
    `    if (override === 'notefall-grand' || override.startsWith('soundfont:')) {`,
    `    if (\n      override === 'notefall-grand' ||\n      override === 'drum:TR-808' ||\n      override.startsWith('soundfont:')\n    ) {`,
  ],
  [`  if (track.percussion || track.channel === 9) return 'soundfont:synth_drum'`, `  if (track.percussion || track.channel === 9) return 'drum:TR-808'`],
])

await patch('tests/instrumentCatalog.test.mjs', [
  [`    'soundfont:synth_drum',`, `    'drum:TR-808',`],
])

await patch('src/audio/instrumentRack.ts', [
  [`import { Soundfont, type StopFn, type Scheduler } from 'smplr'`, `import { DrumMachine, Soundfont, type StopFn, type Scheduler } from 'smplr'`],
  [
    `  scheduler?: Scheduler\n  /** Realtime input/preview needs piano before a song is prepared. */`,
    `  scheduler?: Scheduler\n  onProgress?: (p: LoadProgress) => void\n  /** Realtime input/preview needs piano before a song is prepared. */`,
  ],
  [
    `type SoundfontCtor = new (\n  context: AudioContext,\n  options: Record<string, unknown>,\n) => LegacySoundfont`,
    `type SoundfontCtor = new (\n  context: AudioContext,\n  options: Record<string, unknown>,\n) => LegacySoundfont\n\ntype LegacyDrumMachine = {\n  load?: Promise<unknown>\n  ready?: Promise<unknown>\n  start(options: { note: string; velocity?: number; time?: number; stopId?: string }): StopFn\n  stop(): void\n  disconnect?: () => void\n}\n\ntype DrumMachineCtor = new (\n  context: AudioContext,\n  options: Record<string, unknown>,\n) => LegacyDrumMachine`,
  ],
  [
    `  const soundfonts = new Map<string, LegacySoundfont>()\n  const failedSoundfonts = new Set<string>()`,
    `  const soundfonts = new Map<string, LegacySoundfont>()\n  const failedSoundfonts = new Set<string>()\n  let drums: LegacyDrumMachine | null = null\n  let drumsFailed = false`,
  ],
  [
    `    grand = await createPiano(\n      ctx,\n      onProgress,`,
    `    grand = await createPiano(\n      ctx,\n      onProgress ?? options.onProgress,`,
  ],
  [
    `      await waitForSoundfont(instrument)\n      soundfonts.set(name, instrument)`,
    `      await waitForSoundfont(instrument)\n      soundfonts.set(name, instrument)`,
  ],
  [
    `  async function prepare(\n    song: ParsedSong,`,
    `  async function ensureDrums(\n    onProgress?: (p: LoadProgress) => void,\n  ): Promise<LegacyDrumMachine | null> {\n    if (drums) return drums\n    if (drumsFailed) return null\n    try {\n      const Ctor = DrumMachine as unknown as DrumMachineCtor\n      const instrument = new Ctor(ctx as AudioContext, {\n        instrument: 'TR-808',\n        destination: soundfontExpression,\n        storage: createSampleStorage(),\n        scheduler: options.scheduler,\n        onLoadProgress: (p: LoadProgress) => (onProgress ?? options.onProgress)?.(p),\n      })\n      await (instrument.load ?? instrument.ready ?? Promise.resolve())\n      drums = instrument\n      return drums\n    } catch (error) {\n      console.warn('Could not load drum machine; falling back to Notefall Grand.', error)\n      drumsFailed = true\n      await ensureGrand(onProgress)\n      return null\n    }\n  }\n\n  async function prepare(\n    song: ParsedSong,`,
  ],
  [
    `        if (id === 'notefall-grand') {\n          await ensureGrand(onProgress)\n          return\n        }\n        await ensureSoundfont(id.slice('soundfont:'.length), onProgress)`,
    `        if (id === 'notefall-grand') {\n          await ensureGrand(onProgress)\n          return\n        }\n        if (id === 'drum:TR-808') {\n          await ensureDrums(onProgress)\n          return\n        }\n        await ensureSoundfont(id.slice('soundfont:'.length), onProgress)`,
  ],
  [`  if (options.eagerGrand !== false) await ensureGrand()`, `  if (options.eagerGrand !== false) await ensureGrand(options.onProgress)`],
  [
    `      if (route === 'notefall-grand') {\n        if (!grand) return () => {}\n        return grand.start(midi, velocity, atAudioTime, stopId)\n      }\n\n      const name = route.slice('soundfont:'.length)`,
    `      if (route === 'notefall-grand') {\n        if (!grand) return () => {}\n        return grand.start(midi, velocity, atAudioTime, stopId)\n      }\n\n      if (route === 'drum:TR-808') {\n        const drum = drums\n        if (!drum) return grand?.start(midi, velocity, atAudioTime, stopId) ?? (() => {})\n        const note = drumNameForMidi(midi)\n        return drum.start({\n          note,\n          velocity: Math.max(1, Math.min(127, Math.round(velocity * 127))),\n          time: atAudioTime,\n          stopId,\n        })\n      }\n\n      const name = route.slice('soundfont:'.length)`,
  ],
  [`      for (const instrument of soundfonts.values()) instrument.stop()`, `      for (const instrument of soundfonts.values()) instrument.stop()\n      drums?.stop()`],
  [`      for (const instrument of soundfonts.values()) {`, `      try { drums?.disconnect?.() } catch { /* already disconnected */ }\n      for (const instrument of soundfonts.values()) {`],
])

// Insert the GM-percussion → drum-machine group mapper before rack creation.
await patch('src/audio/instrumentRack.ts', [[
  `/**\n * Shared realtime/offline instrument router.`,
  `function drumNameForMidi(midi: number): string {\n  if (midi === 35 || midi === 36) return 'kick'\n  if (midi === 37) return 'rim-shot'\n  if (midi === 38 || midi === 40) return 'snare'\n  if (midi === 39) return 'clap'\n  if (midi === 42 || midi === 44) return 'closed-hat'\n  if (midi === 46) return 'open-hat'\n  if ([41, 43, 45, 47, 48, 50].includes(midi)) return 'tom'\n  if ([49, 52, 55, 57].includes(midi)) return 'cymbal'\n  if ([51, 53, 59].includes(midi)) return 'cymbal'\n  if (midi === 56) return 'cowbell'\n  if (midi === 70) return 'maracas'\n  return 'snare'\n}\n\n/**\n * Shared realtime/offline instrument router.`,
]])

await patch('src/audio/engine.ts', [
  [
    `import {\n  createPiano,\n  type PianoInstrument,\n  type LoadProgress,\n} from './sampler'`,
    `import { type LoadProgress } from './sampler'\nimport { createInstrumentRack, type InstrumentRack } from './instrumentRack'`,
  ],
  [`  private piano: PianoInstrument | null = null`, `  private piano: InstrumentRack | null = null`],
  [
    `  private transpose = 0\n`,
    `  private transpose = 0\n  // Per-track audio overrides. Missing keys mean Auto from MIDI metadata.\n  private trackInstruments: Record<string, string> = {}\n`,
  ],
  [
    `        this.piano = await createPiano(undefined, onProgress)`,
    `        this.piano = await createInstrumentRack(undefined, {\n          eagerGrand: true,\n          onProgress,\n        })\n        if (this.song) {\n          await this.piano.prepare(this.song, this.trackInstruments, onProgress)\n        }`,
  ],
  [
    `  getTranspose(): number {\n    return this.transpose\n  }\n`,
    `  getTranspose(): number {\n    return this.transpose\n  }\n\n  async setTrackInstruments(assignments: Record<string, string>): Promise<void> {\n    this.trackInstruments = { ...assignments }\n    if (!this.piano || !this.song) return\n    await this.piano.prepare(this.song, this.trackInstruments)\n  }\n`,
  ],
  [
    `    this.song = song\n    this.piano?.setExpression(expressionAt(song.expressions, 0))`,
    `    this.song = song\n    void this.piano?.prepare(song, this.trackInstruments).catch((error) => {\n      console.error('Could not prepare MIDI instruments', error)\n    })\n    this.piano?.setExpression(expressionAt(song.expressions, 0))`,
  ],
  [
    `    if (Tone.getContext().state !== 'running') {\n      await Tone.start()\n    }\n    this.startedAt = now()`,
    `    if (Tone.getContext().state !== 'running') {\n      await Tone.start()\n    }\n    if (this.piano) await this.piano.prepare(this.song, this.trackInstruments)\n    this.startedAt = now()`,
  ],
  [
    `this.piano.start(playedMidi, shaped, audioBase, \`s\${n.id}\`)`,
    `this.piano.start(playedMidi, shaped, audioBase, \`s\${n.id}\`, n.track)`,
  ],
  [
    `this.piano.start(playedMidi, shaped, audioBase + offset, \`s\${n.id}\`)`,
    `this.piano.start(playedMidi, shaped, audioBase + offset, \`s\${n.id}\`, n.track)`,
  ],
])

await patch('src/ui/Inspector.tsx', [
  [
    `import { CAMERA_LIMITS } from '../scene/cameraLimits'`,
    `import { CAMERA_LIMITS } from '../scene/cameraLimits'\nimport { instrumentPickerOptions } from '../audio/instrumentCatalog'`,
  ],
  [
`function TrackColorRows() {
  const { t: tr } = useTranslation('inspector')
  const song = useStore((st) => st.song)
  const trackColors = useEffectiveSetting('trackColors')
  const noteColor = useEffectiveSetting('noteColor')
  const noteTracks =
    song?.tracks.map((t, idx) => ({ t, idx })).filter(({ t }) => t.hasNotes) ?? []
  if (noteTracks.length === 0) {
    return <BoundColorRow label={tr('row.color')} settingKey="noteColor" />
  }
  return (
    <>
      {noteTracks.map(({ t, idx }) => {
        const key = String(idx)
        const hasOverride = trackColors[key] !== undefined
        const value = trackColors[key] ?? noteColor
        return (
          <ColorRow
            key={idx}
            label={t.name}
            value={value}
            onChange={(v) =>
              atomicUpdate({ trackColors: { ...trackColors, [key]: v } })
            }
            defaultValue={noteColor}
            isModified={hasOverride}
            onReset={
              hasOverride
                ? () => {
                    const next = { ...trackColors }
                    delete next[key]
                    atomicUpdate({ trackColors: next })
                  }
                : undefined
            }
          />
        )
      })}
    </>
  )
}`,
`function TrackColorRows() {
  const { t: tr } = useTranslation('inspector')
  const song = useStore((st) => st.song)
  const trackColors = useEffectiveSetting('trackColors')
  const trackInstruments = useEffectiveSetting('trackInstruments') ?? {}
  const noteColor = useEffectiveSetting('noteColor')
  const noteTracks =
    song?.tracks.map((t, idx) => ({ t, idx })).filter(({ t }) => t.hasNotes) ?? []
  if (noteTracks.length === 0) {
    return <BoundColorRow label={tr('row.color')} settingKey="noteColor" />
  }
  return (
    <>
      {noteTracks.map(({ t, idx }) => {
        const key = String(idx)
        const hasOverride = trackColors[key] !== undefined
        const value = trackColors[key] ?? noteColor
        const instrumentValue = trackInstruments[key] ?? 'auto'
        const autoName = t.percussion
          ? 'Drums'
          : (t.instrumentName ?? 'Notefall Grand Piano')
        const instrumentOptions = [
          { value: 'auto', label: \`Auto (\${autoName})\` },
          ...instrumentPickerOptions
            .filter((o) => o.value !== 'auto' && o.group !== 'Sound Effects')
            .map((o) => ({
              value: o.value,
              label: o.value === 'notefall-grand' ? o.label : \`\${o.group} · \${o.label}\`,
            })),
        ]
        return (
          <div key={idx}>
            <ColorRow
              label={t.name}
              value={value}
              onChange={(v) =>
                atomicUpdate({ trackColors: { ...trackColors, [key]: v } })
              }
              defaultValue={noteColor}
              isModified={hasOverride}
              onReset={
                hasOverride
                  ? () => {
                      const next = { ...trackColors }
                      delete next[key]
                      atomicUpdate({ trackColors: next })
                    }
                  : undefined
              }
            />
            <SelectRow
              label={\`\${t.name} · Instrument\`}
              value={instrumentValue}
              options={instrumentOptions}
              onChange={(v) => {
                const next = { ...trackInstruments }
                if (v === 'auto') delete next[key]
                else next[key] = v
                atomicUpdate({ trackInstruments: next })
              }}
              defaultValue="auto"
            />
          </div>
        )
      })}
    </>
  )
}`,
  ],
])

await patch('src/ui/controls.tsx', [
  [`<ListBox className="outline-none">`, `<ListBox className="max-h-80 overflow-y-auto outline-none">`],
])

await patch('src/export/renderAudio.ts', [
  [`import { createPiano } from '../audio/sampler'`, `import { createInstrumentRack } from '../audio/instrumentRack'`],
  [`let piano: Awaited<ReturnType<typeof createPiano>> | null = null`, `let piano: Awaited<ReturnType<typeof createInstrumentRack>> | null = null`],
  [
`    piano = await raceWithAbort(
      createPiano(
        ctx,
        (p) => {
          onProgress?.({ phase: 'loading', loaded: p.loaded, total: p.total })
        },
        {
          scheduler: new Scheduler(ctx, { lookaheadMs: Number.POSITIVE_INFINITY }),
        },
      ),
      signal,
    )`,
`    piano = await raceWithAbort(
      createInstrumentRack(ctx, {
        eagerGrand: false,
        scheduler: new Scheduler(ctx, { lookaheadMs: Number.POSITIVE_INFINITY }),
        onProgress: (p) => {
          onProgress?.({ phase: 'loading', loaded: p.loaded, total: p.total })
        },
      }),
      signal,
    )
    await raceWithAbort(
      piano.prepare(song, settings.trackInstruments ?? {}, (p) => {
        onProgress?.({ phase: 'loading', loaded: p.loaded, total: p.total })
      }),
      signal,
    )`,
  ],
  [
    `const stopFn = piano.start(playedMidi, shaped, onTime, \`s\${n.id}\`)`,
    `const stopFn = piano.start(playedMidi, shaped, onTime, \`s\${n.id}\`, n.track)`,
  ],
])

await patch('src/App.tsx', [
  [
    `<TrackInstrumentSync />\n      {body}`,
    `<TrackInstrumentSync />\n      {body}`,
  ],
])

// Temporary session store is no longer needed because assignments now live
// in normal persisted Settings.
try { await unlink('src/audio/trackInstrumentStore.ts') } catch {}

// The patch runner/workflow remove themselves in the workflow after execution.
console.log('multi-instrument integration patch applied')
