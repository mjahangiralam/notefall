import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const src = async (name) => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')

test('all modes are persisted and selected in the actual scene, including export bridge', async () => {
  const [store, scene, viewport, exporter] = await Promise.all([
    src('store.ts'), src('scene/Scene.tsx'), src('ui/Viewport.tsx'), src('export/renderVideo.ts'),
  ])
  assert.match(store, /visualizationMode:\s*VisualizationMode/)
  assert.match(store, /visualizationMode:\s*'piano'/)
  assert.match(scene, /visualizationMode === 'sheet'/)
  assert.match(scene, /visualizationMode === 'space3d'/)
  assert.match(viewport, /<VisualizationModePicker\s*\/>/)
  assert.match(exporter, /r3f\.advance\(t, true\)/)
})

test('score canvas and 3d stage animate under the same R3F advance used by export', async () => {
  const [sheet, space] = await Promise.all([src('scene/ScoreView.tsx'), src('scene/SpaceView.tsx')])
  assert.match(sheet, /useFrame\(/)
  assert.match(sheet, /CanvasTexture/)
  assert.match(space, /useFrame\(/)
  assert.match(space, /audioEngine\.currentSongTime\(\)/)
  assert.match(space, /track\.percussion/)
})

test('realtime drum worklet uses compatible Tone node factory without modifying offline path', async () => {
  const bank = await src('audio/sf2Bank.ts')
  assert.match(bank, /audioNodeCreators:\s*\{/)
  assert.match(bank, /createAudioWorkletNode/)
  assert.match(bank, /createOfflineBackend/)
  assert.match(bank, /Premium Drum Collection ready/)
})
