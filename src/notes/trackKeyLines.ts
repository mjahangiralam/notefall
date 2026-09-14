import * as THREE from 'three'
import { audioEngine } from '../audio/engine'
import { KEYBOARD_LAYOUT, KEY_COUNT, MIDI_MIN, WHITE_KEY_LENGTH } from '../keyboard/layout'
import { getResolvedSettings } from '../scene/automatedSettings'
import { getR3FState } from '../scene/exportBridge'
import { useStore } from '../store'
import { activeTrackColorHexes, addActiveTrack, type ActiveTrackCounts } from './activeTrackColors'

const MAX_STRIPES_PER_KEY = 8
const MAX_INSTANCES = KEY_COUNT * MAX_STRIPES_PER_KEY
const LINE_HEIGHT = 0.055
const LINE_Z = 0.155

let installed = false
let retryId: number | null = null
let overlay: THREE.InstancedMesh | null = null

const activeByKey: ActiveTrackCounts[] = Array.from(
  { length: KEY_COUNT },
  () => new Map<number, number>(),
)
const dummy = new THREE.Object3D()
const colorScratch = new THREE.Color()

function clearActiveKeys(): void {
  for (const counts of activeByKey) counts.clear()
}

function updateOverlay(mesh: THREE.InstancedMesh): void {
  const state = useStore.getState()
  const song = state.song
  const settings = getResolvedSettings()

  clearActiveKeys()

  if (!song || !settings.hitLineEnabled) {
    mesh.count = 0
    mesh.instanceMatrix.needsUpdate = true
    return
  }

  const midiTime = audioEngine.currentMidiTime()
  const trimStart = settings.midiTrimStartSec
  const trimEnd = settings.midiTrimEndSec ?? song.duration

  if (midiTime < trimStart || midiTime >= trimEnd) {
    mesh.count = 0
    mesh.instanceMatrix.needsUpdate = true
    return
  }

  for (const note of song.notes) {
    if (note.time > midiTime) break
    const noteEnd = Math.min(note.time + note.duration, trimEnd)
    if (noteEnd <= midiTime || noteEnd <= trimStart) continue

    const playedMidi = note.midi + settings.transpose
    const keyIdx = playedMidi - MIDI_MIN
    if (keyIdx < 0 || keyIdx >= KEY_COUNT) continue
    addActiveTrack(activeByKey[keyIdx], note.track)
  }

  const y = settings.keyboardY + WHITE_KEY_LENGTH + LINE_HEIGHT * 0.5
  let slot = 0

  for (let keyIdx = 0; keyIdx < KEY_COUNT && slot < MAX_INSTANCES; keyIdx++) {
    const colors = activeTrackColorHexes(
      activeByKey[keyIdx],
      settings.trackColors,
      settings.noteColor,
    )
    if (colors.length === 0) continue

    const key = KEYBOARD_LAYOUT.keys[keyIdx]
    const stripeColors = colors.slice(0, MAX_STRIPES_PER_KEY)
    const usableWidth = key.width * 0.9
    const stripeWidth = usableWidth / stripeColors.length
    const left = key.x - usableWidth * 0.5

    for (let stripe = 0; stripe < stripeColors.length; stripe++) {
      if (slot >= MAX_INSTANCES) break

      dummy.position.set(
        left + stripeWidth * (stripe + 0.5),
        y,
        LINE_Z,
      )
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(stripeWidth, LINE_HEIGHT, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(slot, dummy.matrix)
      mesh.setColorAt(slot, colorScratch.set(stripeColors[stripe]))
      slot++
    }
  }

  mesh.count = slot
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

function attachOverlay(): void {
  const r3f = getR3FState()
  if (!r3f) {
    retryId = window.requestAnimationFrame(attachOverlay)
    return
  }

  const geometry = new THREE.PlaneGeometry(1, 1)
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  })

  const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES)
  mesh.name = 'InstrumentKeyLines'
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.renderOrder = 4
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.raycast = () => {}
  mesh.onBeforeRender = () => updateOverlay(mesh)

  r3f.scene.add(mesh)
  overlay = mesh
}

/**
 * Install a single imperative R3F overlay for per-instrument contact lines.
 * It is started lazily from trackColor.ts so the existing Scene component
 * does not need another React subscription or render path.
 */
export function installTrackKeyLines(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  attachOverlay()
}

function disposeOverlay(): void {
  if (retryId !== null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(retryId)
    retryId = null
  }
  if (!overlay) return
  overlay.parent?.remove(overlay)
  overlay.geometry.dispose()
  const material = overlay.material
  if (Array.isArray(material)) material.forEach((m) => m.dispose())
  else material.dispose()
  overlay = null
  installed = false
}

if (import.meta.hot) import.meta.hot.dispose(disposeOverlay)
