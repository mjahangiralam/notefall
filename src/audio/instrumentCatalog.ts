import type { TrackInfo } from '../midi/types'

export type InstrumentId = 'auto' | 'notefall-grand' | 'drum:TR-808' | `soundfont:${string}`

export type InstrumentOption = {
  value: InstrumentId
  label: string
  group: string
  program?: number
}

const GM_GROUPS = [
  'Piano',
  'Chromatic Percussion',
  'Organ',
  'Guitar',
  'Bass',
  'Strings',
  'Ensemble',
  'Brass',
  'Reed',
  'Pipe',
  'Synth Lead',
  'Synth Pad',
  'Synth Effects',
  'Ethnic',
  'Percussive',
  'Sound Effects',
] as const

/**
 * General MIDI Level 1 program table in program-number order (0..127).
 * `soundfont` values match the names exposed by the MIDI.js/MusyngKite
 * soundfont set used by smplr's Soundfont player.
 */
export const GM_PROGRAMS = [
  ['Acoustic Grand Piano', 'acoustic_grand_piano'],
  ['Bright Acoustic Piano', 'bright_acoustic_piano'],
  ['Electric Grand Piano', 'electric_grand_piano'],
  ['Honky-tonk Piano', 'honkytonk_piano'],
  ['Electric Piano 1', 'electric_piano_1'],
  ['Electric Piano 2', 'electric_piano_2'],
  ['Harpsichord', 'harpsichord'],
  ['Clavinet', 'clavinet'],
  ['Celesta', 'celesta'],
  ['Glockenspiel', 'glockenspiel'],
  ['Music Box', 'music_box'],
  ['Vibraphone', 'vibraphone'],
  ['Marimba', 'marimba'],
  ['Xylophone', 'xylophone'],
  ['Tubular Bells', 'tubular_bells'],
  ['Dulcimer', 'dulcimer'],
  ['Drawbar Organ', 'drawbar_organ'],
  ['Percussive Organ', 'percussive_organ'],
  ['Rock Organ', 'rock_organ'],
  ['Church Organ', 'church_organ'],
  ['Reed Organ', 'reed_organ'],
  ['Accordion', 'accordion'],
  ['Harmonica', 'harmonica'],
  ['Tango Accordion', 'tango_accordion'],
  ['Acoustic Guitar (nylon)', 'acoustic_guitar_nylon'],
  ['Acoustic Guitar (steel)', 'acoustic_guitar_steel'],
  ['Electric Guitar (jazz)', 'electric_guitar_jazz'],
  ['Electric Guitar (clean)', 'electric_guitar_clean'],
  ['Electric Guitar (muted)', 'electric_guitar_muted'],
  ['Overdriven Guitar', 'overdriven_guitar'],
  ['Distortion Guitar', 'distortion_guitar'],
  ['Guitar Harmonics', 'guitar_harmonics'],
  ['Acoustic Bass', 'acoustic_bass'],
  ['Electric Bass (finger)', 'electric_bass_finger'],
  ['Electric Bass (pick)', 'electric_bass_pick'],
  ['Fretless Bass', 'fretless_bass'],
  ['Slap Bass 1', 'slap_bass_1'],
  ['Slap Bass 2', 'slap_bass_2'],
  ['Synth Bass 1', 'synth_bass_1'],
  ['Synth Bass 2', 'synth_bass_2'],
  ['Violin', 'violin'],
  ['Viola', 'viola'],
  ['Cello', 'cello'],
  ['Contrabass', 'contrabass'],
  ['Tremolo Strings', 'tremolo_strings'],
  ['Pizzicato Strings', 'pizzicato_strings'],
  ['Orchestral Harp', 'orchestral_harp'],
  ['Timpani', 'timpani'],
  ['String Ensemble 1', 'string_ensemble_1'],
  ['String Ensemble 2', 'string_ensemble_2'],
  ['Synth Strings 1', 'synth_strings_1'],
  ['Synth Strings 2', 'synth_strings_2'],
  ['Choir Aahs', 'choir_aahs'],
  ['Voice Oohs', 'voice_oohs'],
  ['Synth Voice', 'synth_choir'],
  ['Orchestra Hit', 'orchestra_hit'],
  ['Trumpet', 'trumpet'],
  ['Trombone', 'trombone'],
  ['Tuba', 'tuba'],
  ['Muted Trumpet', 'muted_trumpet'],
  ['French Horn', 'french_horn'],
  ['Brass Section', 'brass_section'],
  ['Synth Brass 1', 'synth_brass_1'],
  ['Synth Brass 2', 'synth_brass_2'],
  ['Soprano Sax', 'soprano_sax'],
  ['Alto Sax', 'alto_sax'],
  ['Tenor Sax', 'tenor_sax'],
  ['Baritone Sax', 'baritone_sax'],
  ['Oboe', 'oboe'],
  ['English Horn', 'english_horn'],
  ['Bassoon', 'bassoon'],
  ['Clarinet', 'clarinet'],
  ['Piccolo', 'piccolo'],
  ['Flute', 'flute'],
  ['Recorder', 'recorder'],
  ['Pan Flute', 'pan_flute'],
  ['Blown Bottle', 'blown_bottle'],
  ['Shakuhachi', 'shakuhachi'],
  ['Whistle', 'whistle'],
  ['Ocarina', 'ocarina'],
  ['Lead 1 (square)', 'lead_1_square'],
  ['Lead 2 (sawtooth)', 'lead_2_sawtooth'],
  ['Lead 3 (calliope)', 'lead_3_calliope'],
  ['Lead 4 (chiff)', 'lead_4_chiff'],
  ['Lead 5 (charang)', 'lead_5_charang'],
  ['Lead 6 (voice)', 'lead_6_voice'],
  ['Lead 7 (fifths)', 'lead_7_fifths'],
  ['Lead 8 (bass + lead)', 'lead_8_bass__lead'],
  ['Pad 1 (new age)', 'pad_1_new_age'],
  ['Pad 2 (warm)', 'pad_2_warm'],
  ['Pad 3 (polysynth)', 'pad_3_polysynth'],
  ['Pad 4 (choir)', 'pad_4_choir'],
  ['Pad 5 (bowed)', 'pad_5_bowed'],
  ['Pad 6 (metallic)', 'pad_6_metallic'],
  ['Pad 7 (halo)', 'pad_7_halo'],
  ['Pad 8 (sweep)', 'pad_8_sweep'],
  ['FX 1 (rain)', 'fx_1_rain'],
  ['FX 2 (soundtrack)', 'fx_2_soundtrack'],
  ['FX 3 (crystal)', 'fx_3_crystal'],
  ['FX 4 (atmosphere)', 'fx_4_atmosphere'],
  ['FX 5 (brightness)', 'fx_5_brightness'],
  ['FX 6 (goblins)', 'fx_6_goblins'],
  ['FX 7 (echoes)', 'fx_7_echoes'],
  ['FX 8 (sci-fi)', 'fx_8_scifi'],
  ['Sitar', 'sitar'],
  ['Banjo', 'banjo'],
  ['Shamisen', 'shamisen'],
  ['Koto', 'koto'],
  ['Kalimba', 'kalimba'],
  ['Bag Pipe', 'bagpipe'],
  ['Fiddle', 'fiddle'],
  ['Shanai', 'shanai'],
  ['Tinkle Bell', 'tinkle_bell'],
  ['Agogo', 'agogo'],
  ['Steel Drums', 'steel_drums'],
  ['Woodblock', 'woodblock'],
  ['Taiko Drum', 'taiko_drum'],
  ['Melodic Tom', 'melodic_tom'],
  ['Synth Drum', 'synth_drum'],
  ['Reverse Cymbal', 'reverse_cymbal'],
  ['Guitar Fret Noise', 'guitar_fret_noise'],
  ['Breath Noise', 'breath_noise'],
  ['Seashore', 'seashore'],
  ['Bird Tweet', 'bird_tweet'],
  ['Telephone Ring', 'telephone_ring'],
  ['Helicopter', 'helicopter'],
  ['Applause', 'applause'],
  ['Gunshot', 'gunshot'],
] as const satisfies readonly (readonly [string, string])[]

function groupForProgram(program: number): string {
  const idx = Math.max(0, Math.min(15, Math.floor(program / 8)))
  return GM_GROUPS[idx]
}

export const instrumentPickerGroups = GM_GROUPS.map((group, groupIdx) => ({
  group,
  options: GM_PROGRAMS.slice(groupIdx * 8, groupIdx * 8 + 8).map(
    ([label, soundfont], offset) => {
      const program = groupIdx * 8 + offset
      return {
        value: `soundfont:${soundfont}` as InstrumentId,
        label,
        group,
        program,
      }
    },
  ),
}))

export const instrumentPickerOptions: InstrumentOption[] = [
  { value: 'auto', label: 'Auto (from MIDI)', group: 'Automatic' },
  { value: 'notefall-grand', label: 'Notefall Grand Piano', group: 'Piano' },
  ...instrumentPickerGroups.flatMap(({ options }) => options),
]

export function gmProgramOption(program: number): InstrumentOption | null {
  const row = GM_PROGRAMS[program]
  if (!row) return null
  return {
    value: `soundfont:${row[1]}`,
    label: row[0],
    group: groupForProgram(program),
    program,
  }
}

export function resolveTrackInstrument(
  track: TrackInfo,
  override?: string,
): Exclude<InstrumentId, 'auto'> {
  if (override && override !== 'auto') {
    if (
      override === 'notefall-grand' ||
      override === 'drum:TR-808' ||
      override.startsWith('soundfont:')
    ) {
      return override as Exclude<InstrumentId, 'auto'>
    }
  }

  if (track.percussion || track.channel === 9) return 'drum:TR-808'

  const program = track.program
  if (program === 0) return 'notefall-grand'
  if (program === null || program === undefined || program < 0 || program >= GM_PROGRAMS.length) {
    return 'notefall-grand'
  }

  return `soundfont:${GM_PROGRAMS[program][1]}`
}

export function requiredInstrumentIds(
  tracks: readonly TrackInfo[],
  overrides: Record<string, string>,
): Exclude<InstrumentId, 'auto'>[] {
  const ids = new Set<Exclude<InstrumentId, 'auto'>>()
  tracks.forEach((track, idx) => {
    if (!track.hasNotes) return
    ids.add(resolveTrackInstrument(track, overrides[String(idx)]))
  })
  return Array.from(ids).sort()
}
