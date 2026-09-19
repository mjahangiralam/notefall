import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = () => readFile(new URL('../src/audio/sf2Bank.ts', import.meta.url), 'utf8')

test('Premium Drum Collection replaces the GeneralUser repo asset for both playback and export', async () => {
  const code = await source()
  assert.match(code, /PREMIUM_DRUM_SF2_URL\s*=\s*['"]\/samples\/premium-drum-collection-gm\/Premium_Drum_Collection_GM\.sf2['"]/) 
  assert.match(code, /fetchBytes\(PREMIUM_DRUM_SF2_URL\)/)
  assert.doesNotMatch(code, /GENERALUSER_GS_URL|GeneralUser-GS\.sf2/)
  assert.match(code, /SoundBankLoader\.fromArrayBuffer\(bytes\)/)
  assert.match(code, /soundBankManager\.addSoundBank\(\s*bytes,/)
})

test('realtime and offline use SpessaSynth with the same kit routing', async () => {
  const code = await source()
  assert.match(code, /new\s+WorkletSynthesizer\(/)
  assert.match(code, /new\s+SpessaSynthProcessor\(sampleRate\)/)
  assert.match(code, /POWER_DRUM_CHANNEL\s*=\s*9/)
  assert.match(code, /POWER_KIT_PROGRAM\s*=\s*16/)
  assert.match(code, /ORCHESTRAL_DRUM_CHANNEL\s*=\s*8/)
  assert.match(code, /ORCHESTRAL_KIT_PROGRAM\s*=\s*48/)
  assert.match(code, /ORCHESTRAL_BANK_MSB\s*=\s*120/)
  assert.match(code, /controllerChange\(ORCHESTRAL_DRUM_CHANNEL,\s*0,\s*ORCHESTRAL_BANK_MSB\)/)
  assert.match(code, /programChange\(POWER_DRUM_CHANNEL,\s*POWER_KIT_PROGRAM\)/)
  assert.match(code, /programChange\(ORCHESTRAL_DRUM_CHANNEL,\s*ORCHESTRAL_KIT_PROGRAM\)/)
})

test('drum notes keep GM MIDI pitch and are allowed to decay naturally', async () => {
  const code = await source()
  assert.match(code, /synth\.noteOn\(channel,\s*midi,\s*midiVelocity\(velocity\),/)
  assert.doesNotMatch(code, /synth\.noteOff\(/)
  assert.match(code, /synth\.process\(left,\s*right,\s*rendered,\s*count\)/)
  assert.match(code, /audioWorklet\.addModule\(SPESSASYNTH_WORKLET_URL\)/)
})
