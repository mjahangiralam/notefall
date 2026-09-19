import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sf2Path = new URL('../public/samples/premium-drum-collection-gm/Premium_Drum_Collection_GM.sf2', import.meta.url)

test('Premium SF2 has the expected percussion-only presets for Power and Orchestra', async () => {
  const bytes = await readFile(sf2Path)
  const phdr = bytes.indexOf(Buffer.from('phdr'))
  assert.ok(phdr > 0, 'SF2 preset headers not found')
  const count = bytes.readUInt32LE(phdr + 4) / 38 - 1
  const presets = Array.from({ length: count }, (_, i) => {
    const offset = phdr + 8 + i * 38
    return { program: bytes.readUInt16LE(offset + 20), bank: bytes.readUInt16LE(offset + 22) }
  })
  assert.ok(presets.every(p => p.bank === 128), 'This file must be drum-only')
  assert.ok(presets.some(p => p.program === 16 && p.bank === 128), 'Power kit missing')
  assert.ok(presets.some(p => p.program === 48 && p.bank === 128), 'Orchestra kit missing')
})
