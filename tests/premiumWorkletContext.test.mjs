import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Premium realtime synthesis uses Tone audio worklet factory for Tone wrapped contexts', async () => {
  const source = await readFile(new URL('../src/audio/sf2Bank.ts', import.meta.url), 'utf8')
  assert.match(source, /audioNodeCreators\s*:\s*\{/)
  assert.match(source, /worklet\s*:/)
  assert.match(source, /createAudioWorkletNode\(/)
  assert.match(source, /new\s+WorkletSynthesizer\(/)
  assert.match(source, /PREMIUM_DRUM_SF2_URL/)
})
