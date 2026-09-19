import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { audioEngine } from '../audio/engine'
import { useStore } from '../store'
import type { NoteEvent, TrackInfo } from '../midi/types'
import { modelForTrack } from './instrumentAppearance'
import { InstrumentModelMesh } from './InstrumentModels'

/** Free-orbit camera: left-drag to orbit, wheel to zoom. Slow cinematic orbit
 * advances from the song's virtual clock, so exports follow the same path. */
export function SpaceCamera() {
  const { camera, gl } = useThree()
  const angle = useRef(0)
  const elevation = useRef(0.30)
  const distance = useRef(14)
  useEffect(() => {
    let dragging = false
    let x = 0, y = 0
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      dragging = true
      x = e.clientX; y = e.clientY
      gl.domElement.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      angle.current -= (e.clientX - x) * 0.005
      elevation.current = THREE.MathUtils.clamp(elevation.current + (e.clientY - y) * 0.003, 0.08, 0.95)
      x = e.clientX; y = e.clientY
    }
    const up = () => { dragging = false }
    const wheel = (e: WheelEvent) => {
      // Keep the browser from scrolling the whole app while zooming the stage.
      e.preventDefault()
      distance.current = THREE.MathUtils.clamp(distance.current + e.deltaY * 0.01, 9, 23)
    }
    gl.domElement.addEventListener('pointerdown', down)
    gl.domElement.addEventListener('pointermove', move)
    gl.domElement.addEventListener('pointerup', up)
    gl.domElement.addEventListener('pointercancel', up)
    gl.domElement.addEventListener('wheel', wheel, { passive: false })
    return () => {
      gl.domElement.removeEventListener('pointerdown', down)
      gl.domElement.removeEventListener('pointermove', move)
      gl.domElement.removeEventListener('pointerup', up)
      gl.domElement.removeEventListener('pointercancel', up)
      gl.domElement.removeEventListener('wheel', wheel)
    }
  }, [gl])
  useFrame(() => {
    const a = angle.current + audioEngine.currentSongTime() * 0.035
    const h = elevation.current
    const d = distance.current
    camera.position.set(Math.sin(a) * d * Math.cos(h), 1.0 + d * Math.sin(h), Math.cos(a) * d * Math.cos(h))
    if ('fov' in camera) {
      const c = camera as THREE.PerspectiveCamera
      if (c.fov !== 43) { c.fov = 43; c.updateProjectionMatrix() }
    }
    camera.lookAt(0, -0.05, 0)
  })
  return null
}

function recentStrike(notes: readonly NoteEvent[], time: number): number {
  let lo = 0, hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (notes[mid].time <= time) lo = mid + 1
    else hi = mid
  }
  let power = 0
  // Only a few simultaneous notes are needed for the stage pulse.
  for (let i = lo - 1; i >= Math.max(0, lo - 24); i--) {
    const note = notes[i]
    const dt = time - note.time
    if (dt > 0.45) break
    power = Math.max(power, (1 - dt / 0.45) * note.velocity)
  }
  return power
}

/** Labels are baked into the WebGL scene so video export includes them. */
function ModelNameplate({ label }: { label: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 100
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('3D instrument labels require 2D canvas')
    ctx.fillStyle = 'rgba(14, 20, 32, 0.78)'
    ctx.fillRect(0, 8, 640, 84)
    ctx.strokeStyle = '#b0bdd3'
    ctx.lineWidth = 2
    ctx.strokeRect(2, 10, 636, 80)
    ctx.font = 'bold 34px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f8fafc'
    ctx.fillText(label, 320, 51, 610)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [label])
  useEffect(() => () => texture.dispose(), [texture])
  return <sprite position={[0, -0.55, 0]} scale={[1.65, 0.28, 1]}>
    <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
  </sprite>
}

function SpaceInstrument({ index, track, notes, position, scaleFactor }: { index: number; track: TrackInfo; notes: readonly NoteEvent[]; position: [number, number, number]; scaleFactor: number }) {
  const group = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const model = modelForTrack(track)
  const modelLabel = track.instrumentName || (track.name && !/^Track \d+$/i.test(track.name) ? track.name : model.replace(/([a-z])([A-Z])/g, '$1 $2'))
  const tint = useStore((s) => s.settings.trackColors[String(index)] ?? s.settings.noteColor)
  useFrame(() => {
    const t = audioEngine.currentMidiTime()
    const pulse = recentStrike(notes, t)
    if (group.current) {
      group.current.scale.setScalar(scaleFactor * (1 + pulse * 0.09))
      group.current.position.y = position[1] + pulse * 0.22
      group.current.rotation.y = Math.sin(t * 0.6 + index) * 0.025
    }
    if (light.current) light.current.intensity = 0.3 + pulse * 4
  })
  return <group ref={group} position={position}>
    <pointLight ref={light} color={tint} distance={4} intensity={0.5} />
    <InstrumentModelMesh model={model} tint={tint} />
    <ModelNameplate label={modelLabel} />
  </group>
}

function checkerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    ctx.fillStyle = (row + col) % 2 ? '#171923' : '#222530'
    ctx.fillRect(col * 32, row * 32, 32, 32)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(6, 6)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function SpaceView() {
  const song = useStore((s) => s.song)
  const checker = useMemo(checkerTexture, [])
  useEffect(() => () => checker.dispose(), [checker])
  const active = useMemo(() => {
    return (song?.tracks ?? []).map((track, index) => ({ track, index }))
      .filter(({ track }) => track.hasNotes)
  }, [song])
  const notesByTrack = useMemo(() => {
    const map = new Map<number, NoteEvent[]>()
    for (const note of song?.notes ?? []) {
      if (!map.has(note.track)) map.set(note.track, [])
      map.get(note.track)!.push(note)
    }
    return map
  }, [song])
  return <group>
    <hemisphereLight args={['#dbeafe', '#172033', 1.45]} />
    <directionalLight castShadow shadow-mapSize={[1024, 1024]} position={[-5, 9, 6]} intensity={2.3} color="#dbeafe" />
    <spotLight position={[2, 9, -4]} intensity={3.5} angle={0.55} penumbra={0.7} color="#7dd3fc" />
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.65, 0]}>
      <planeGeometry args={[180, 180]} />
      <meshStandardMaterial map={checker} metalness={0.08} roughness={0.8} />
    </mesh>
    <mesh position={[0, -1.42, 0]}>
      <cylinderGeometry args={[5.65, 6.0, 0.46, 80]} />
      <meshStandardMaterial color="#4b5563" roughness={0.82} metalness={0.15} />
    </mesh>
    <mesh receiveShadow position={[0, -1.18, 0]}>
      <cylinderGeometry args={[5.57, 5.57, 0.04, 80]} />
      <meshStandardMaterial color="#969da6" roughness={0.84} metalness={0.06} />
    </mesh>
    {active.map(({ track, index }, i) => {
      const count = active.length
      // Multiple concentric rows show every active MIDI track, instead of
      // silently dropping the ninth and later tracks. Scale crowded stages.
      const rings = Math.max(1, Math.ceil(count / 12))
      const ring = Math.floor(i / 12)
      const slots = Math.min(12, count - ring * 12)
      const slot = i - ring * 12
      const a = count === 1 ? 0 : -Math.PI * 0.8 + (slot / Math.max(1, slots - 1)) * Math.PI * 1.6 + ring * 0.22
      const radius = rings === 1 ? (count <= 3 ? 2.15 : 3.2) : 1.6 + (ring / Math.max(1, rings - 1)) * 3.1
      const scaleFactor = count <= 8 ? 1 : count <= 18 ? 0.73 : count <= 36 ? 0.52 : 0.33
      return <SpaceInstrument key={index} index={index} track={track} notes={notesByTrack.get(index) ?? []} scaleFactor={scaleFactor} position={[Math.sin(a) * radius, -1.10, Math.cos(a) * radius]} />
    })}
  </group>
}
