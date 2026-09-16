import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('GeneralUser bank is loaded from the repo-hosted public asset', async () => {
  const source = await readFile(new URL('../src/audio/sf2Bank.ts', import.meta.url), 'utf8').catch(() => '')
  assert.match(source, /GENERALUSER_GS_URL\s*=\s*`\/samples\/\$\{GENERALUSER_GS_PATH\}`/)
  assert.doesNotMatch(source, /samples\.notefall\.app/)
})

test('realtime drum backend uses SpessaSynth instead of the old raw SF2 zone renderer', async () => {
  const source = await readFile(new URL('../src/audio/sf2Bank.ts', import.meta.url), 'utf8').catch(() => '')
  assert.match(source, /import\s*\{\s*WorkletSynthesizer\s*\}\s*from\s*['"]spessasynth_lib['"]/)
  assert.match(source, /new\s+WorkletSynthesizer\(/)
  assert.doesNotMatch(source, /new\s+SoundFont2\(/)
  assert.doesNotMatch(source, /selectGeneralUserDrumInstrument|PreparedZone|matchesMidiZone/)
})

test('SpessaSynth worklet is registered from the local public asset', async () => {
  const source = await readFile(new URL('../src/audio/sf2Bank.ts', import.meta.url), 'utf8').catch(() => '')
  assert.match(source, /SPESSASYNTH_WORKLET_URL\s*=\s*['"]\/spessasynth_processor\.min\.js['"]/)
  assert.match(source, /audioWorklet\.addModule\(SPESSASYNTH_WORKLET_URL\)/)
})

test('GeneralUser bytes still load through the Notefall sample cache', async () => {
  const source = await readFile(new URL('../src/audio/sf2Bank.ts', import.meta.url), 'utf8').catch(() => '')
  assert.match(source, /options\.fetchBytes\s*\?\?\s*fetchSampleBytes/)
  assert.match(source, /fetchBytes\(GENERALUSER_GS_URL\)/)
  assert.match(source, /soundBankManager\.addSoundBank\(\s*bytes,/)
  assert.match(source, /SoundBankLoader\.fromArrayBuffer\(bytes\)/)
})

test('Power and orchestral GeneralUser kits are configured on separate channels', async () => {
  const source = await readFile(new URL('../src/audio/sf2Bank.ts', import.meta.url), 'utf8').catch(() => '')
  assert.match(source, /POWER_DRUM_CHANNEL\s*=\s*9/)
  assert.match(source, /POWER_KIT_PROGRAM\s*=\s*16/)
  assert.match(source, /ORCHESTRAL_DRUM_CHANNEL\s*=\s*8/)
  assert.match(source, /ORCHESTRAL_KIT_PROGRAM\s*=\s*48/)
  assert.match(source, /ORCHESTRAL_BANK_MSB\s*=\s*120/)
  assert.match(source, /controllerChange\(ORCHESTRAL_DRUM_CHANNEL,\s*0,\s*ORCHESTRAL_BANK_MSB\)/)
  assert.match(source, /programChange\(POWER_DRUM_CHANNEL,\s*POWER_KIT_PROGRAM\)/)
  assert.match(source, /programChange\(ORCHESTRAL_DRUM_CHANNEL,\s*ORCHESTRAL_KIT_PROGRAM\)/)
})

test('drum notes preserve raw GM pitch and are not cut off by short MIDI note durations', async () => {
  const source = await readFile(new URL('../src/audio/sf2Bank.ts', import.meta.url), 'utf8').catch(() => '')
  assert.match(source, /synth\.noteOn\(channel,\s*midi,\s*midiVelocity\(velocity\),/)
  assert.doesNotMatch(source, /drumNameForMidi|midi\s*[-+]\s*\d+/)
  assert.doesNotMatch(source, /synth\.noteOff\(/)
})

test('offline export renders SpessaSynth PCM before handing it to the Web Audio mix', async () => {
  const source = await readFile(new URL('../src/audio/sf2Bank.ts', import.meta.url), 'utf8').catch(() => '')
  assert.match(source, /new\s+SpessaSynthProcessor\(sampleRate\)/)
  assert.match(source, /synth\.process\(left,\s*right,\s*rendered,\s*count\)/)
  assert.match(source, /context\.createBufferSource\(\)/)
  assert.match(source, /source\.connect\(destination\)/)
})
