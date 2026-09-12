import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function loadExpressionModule() {
  const url = new URL('../src/midi/expressionMap.ts', import.meta.url)
  let source = ''
  try {
    source = await readFile(url, 'utf8')
  } catch {
    assert.fail('src/midi/expressionMap.ts is missing; implement the expression automation module')
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: 'expressionMap.ts',
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

test('no expression points means unity gain', async () => {
  const { expressionAt } = await loadExpressionModule()
  assert.equal(expressionAt([], 12), 1)
})

test('expression holds the first and last values outside the curve', async () => {
  const { expressionAt, normalizeExpressionPoints } = await loadExpressionModule()
  const points = normalizeExpressionPoints([
    { time: 2, value: 0.4 },
    { time: 6, value: 0.8 },
  ])
  assert.equal(expressionAt(points, 0), 0.4)
  assert.equal(expressionAt(points, 10), 0.8)
})

test('expression interpolates linearly between controller points', async () => {
  const { expressionAt, normalizeExpressionPoints } = await loadExpressionModule()
  const points = normalizeExpressionPoints([
    { time: 0, value: 0.2 },
    { time: 10, value: 1 },
  ])
  assert.ok(Math.abs(expressionAt(points, 5) - 0.6) < 1e-9)
})

test('normalization sorts points and clamps time and value', async () => {
  const { normalizeExpressionPoints } = await loadExpressionModule()
  assert.deepEqual(
    normalizeExpressionPoints([
      { time: 4, value: 2 },
      { time: -3, value: -1 },
    ]),
    [
      { time: 0, value: 0 },
      { time: 4, value: 1 },
    ],
  )
})

test('duplicate-time points collapse to the last value', async () => {
  const { normalizeExpressionPoints } = await loadExpressionModule()
  assert.deepEqual(
    normalizeExpressionPoints([
      { time: 1, value: 0.2 },
      { time: 1, value: 0.75 },
      { time: 2, value: 0.9 },
    ]),
    [
      { time: 1, value: 0.75 },
      { time: 2, value: 0.9 },
    ],
  )
})

test('visual expression scale is neutral without automation and subtle with it', async () => {
  const { expressionVisualScale } = await loadExpressionModule()
  assert.equal(expressionVisualScale(1, false), 1)
  assert.equal(expressionVisualScale(0, true), 0.82)
  assert.equal(expressionVisualScale(1, true), 1)
})
