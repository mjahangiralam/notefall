import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const src = (file) => readFile(new URL(`../src/scene/${file}`, import.meta.url), 'utf8')

test('notation builds independently labeled parts, retaining a grand staff for a wide-range solo part', async () => {
  const code = await src('scoreLayout.ts')
  assert.match(code, /export function buildScoreParts/)
  assert.match(code, /trackIndex/)
  assert.match(code, /'treble'/)
  assert.match(code, /'bass'/)
  assert.match(code, /'percussion'/)
  assert.match(code, /solo/)
})

test('score draws each part and independently renders drums, rests and barlines', async () => {
  const code = await src('ScoreView.tsx')
  assert.match(code, /buildScoreParts\(song\)/)
  assert.match(code, /part\.trackIndex/)
  assert.match(code, /drawRest\(/)
  assert.match(code, /drawPercussionNote\(/)
  assert.doesNotMatch(code, /Percussion:.*events in this view/)
})

test('instrument catalog covers all 128 GM programs with instrument-specific representations', async () => {
  const code = await src('instrumentAppearance.ts')
  assert.match(code, /export function modelForTrack/)
  assert.match(code, /program >= 120/)
  assert.match(code, /program >= 112/)
  assert.match(code, /program >= 104/)
  assert.match(code, /program >= 80/)
  assert.match(code, /program >= 56/)
})

test('3D space displays instrument-specific geometry and no music note placeholders or track limit', async () => {
  const code = await src('SpaceView.tsx')
  assert.match(code, /modelForTrack\(track\)/)
  const models = await src('InstrumentModels.tsx')
  assert.match(models, /case 'saxophone'/)
  assert.match(models, /case 'harp'/)
  assert.match(models, /case 'trombone'/)
  assert.doesNotMatch(code, /\.slice\(0, 8\)/)
  assert.doesNotMatch(code, /MusicNote|PlaceholderNote|<Text[^>]*>♫/)
})
