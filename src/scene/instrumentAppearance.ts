import type { TrackInfo } from '../midi/types'

/** General MIDI programs are zero-based. Every valid program resolves to a
 * recognizable instrument model; unsupported metadata gets a keys/synth rig,
 * never a floating placeholder music-note icon. */
export type InstrumentModel =
  | 'grandPiano' | 'electricPiano' | 'organ' | 'accordion'
  | 'guitar' | 'bass' | 'violin' | 'cello' | 'harp'
  | 'trumpet' | 'trombone' | 'tuba' | 'saxophone'
  | 'clarinet' | 'flute' | 'oboe' | 'bagpipe'
  | 'drums' | 'mallets' | 'bells' | 'synth' | 'choir' | 'fx'

export function modelForTrack(track: TrackInfo): InstrumentModel {
  if (track.percussion || track.channel === 9) return 'drums'
  const program = track.program
  if (typeof program === 'number' && Number.isInteger(program) && program >= 0 && program < 128) {
    if (program >= 120) return 'fx'
    if (program >= 112) return program === 112 || program === 113 || program === 114 ? 'bells' : 'drums'
    if (program >= 104) {
      if (program === 109) return 'bagpipe'
      if (program === 108) return 'mallets'
      if (program === 110) return 'violin'
      if (program === 111) return 'oboe'
      return 'guitar'
    }
    if (program >= 80) return 'synth'
    if (program >= 72) return 'flute'
    if (program >= 64) return program <= 67 ? 'saxophone' : program === 71 ? 'clarinet' : 'oboe'
    if (program >= 56) return program === 57 ? 'trombone' : program === 58 ? 'tuba' : 'trumpet'
    if (program >= 48) return program >= 52 && program <= 54 ? 'choir' : 'violin'
    if (program >= 40) return program === 46 ? 'harp' : program === 42 || program === 43 ? 'cello' : program === 47 ? 'drums' : 'violin'
    if (program >= 32) return 'bass'
    if (program >= 24) return 'guitar'
    if (program >= 16) return program >= 21 && program <= 23 ? 'accordion' : 'organ'
    if (program >= 8) return program === 8 || program === 9 || program === 14 ? 'bells' : 'mallets'
    return program <= 3 ? 'grandPiano' : 'electricPiano'
  }
  const name = `${track.name ?? ''} ${track.instrumentName ?? ''} ${track.instrumentFamily ?? ''}`.toLowerCase()
  if (/drum|percussion|timpani|cymbal/.test(name)) return 'drums'
  if (/trombone/.test(name)) return 'trombone'
  if (/tuba/.test(name)) return 'tuba'
  if (/sax/.test(name)) return 'saxophone'
  if (/clarinet/.test(name)) return 'clarinet'
  if (/oboe|bassoon|horn/.test(name)) return 'oboe'
  if (/flute|piccolo|recorder/.test(name)) return 'flute'
  if (/trumpet|brass/.test(name)) return 'trumpet'
  if (/harp/.test(name)) return 'harp'
  if (/violin|fiddle|viola|string/.test(name)) return 'violin'
  if (/cello|contrabass/.test(name)) return 'cello'
  if (/bass/.test(name)) return 'bass'
  if (/guitar|banjo|sitar|koto/.test(name)) return 'guitar'
  if (/accordion|harmonica/.test(name)) return 'accordion'
  if (/organ/.test(name)) return 'organ'
  if (/piano/.test(name)) return 'grandPiano'
  if (/choir|voice|vocal/.test(name)) return 'choir'
  if (/marimba|vibraphone|xylophone/.test(name)) return 'mallets'
  return 'synth'
}
