import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { audioEngine } from '../audio/engine'
import { useStore } from '../store'
import type { NoteEvent, TrackInfo } from '../midi/types'

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

type Family = 'drums' | 'bass' | 'guitar' | 'brass' | 'wind' | 'keys' | 'strings'

function familyFor(track: TrackInfo): Family {
  if (track.percussion || track.channel === 9) return 'drums'
  const name = `${track.name} ${track.instrumentName ?? ''} ${track.instrumentFamily ?? ''}`.toLowerCase()
  if (/bass/.test(name)) return 'bass'
  if (/guitar|banjo|sitar/.test(name)) return 'guitar'
  if (/trumpet|trombone|horn|brass|tuba/.test(name)) return 'brass'
  if (/flute|sax|clarinet|oboe|wind|piccolo|recorder/.test(name)) return 'wind'
  if (/violin|viola|cello|string|harp/.test(name)) return 'strings'
  return 'keys'
}

function Box({ position, size, color, metalness = 0 }: { position: [number, number, number]; size: [number, number, number]; color: string; metalness?: number }) {
  return <mesh position={position} castShadow><boxGeometry args={size} /><meshStandardMaterial color={color} metalness={metalness} roughness={0.37} /></mesh>
}

function Cylinder({ position, radius, height, color, rotation = [0, 0, 0] }: { position: [number, number, number]; radius: number; height: number; color: string; rotation?: [number, number, number] }) {
  return <mesh position={position} rotation={rotation} castShadow><cylinderGeometry args={[radius, radius, height, 24]} /><meshStandardMaterial color={color} metalness={0.5} roughness={0.36} /></mesh>
}

function DrumKit({ color }: { color: string }) {
  return <group>
    <Cylinder position={[0, 0.22, 0.3]} radius={0.54} height={0.44} color={color} rotation={[Math.PI / 2, 0, 0]} />
    <Cylinder position={[-0.74, 0.48, -0.1]} radius={0.34} height={0.46} color={color} />
    <Cylinder position={[0.74, 0.48, -0.1]} radius={0.34} height={0.46} color={color} />
    <Cylinder position={[-0.36, 1.13, -0.27]} radius={0.27} height={0.38} color={color} />
    <Cylinder position={[0.36, 1.13, -0.27]} radius={0.27} height={0.38} color={color} />
    {([-1.2, 1.15] as number[]).map((x) => <group key={x}>
      <Cylinder position={[x, 0.85, -0.35]} radius={0.032} height={1.6} color="#aab3c3" />
      <Cylinder position={[x, 1.65, -0.35]} radius={0.46} height={0.045} color="#f9c45e" />
    </group>)}
    <Cylinder position={[0, -0.02, 0.55]} radius={0.21} height={0.06} color="#cbd5e1" rotation={[Math.PI / 2, 0, 0]} />
  </group>
}

function Guitar({ color, bass = false }: { color: string; bass?: boolean }) {
  return <group rotation={[0, 0, -0.12]}>
    <mesh position={[-0.1, 0.72, 0]} castShadow><sphereGeometry args={[0.44, 20, 16]} /><meshStandardMaterial color={color} metalness={0.35} roughness={0.28} /></mesh>
    <mesh position={[0.10, 0.97, 0]} castShadow><sphereGeometry args={[0.31, 20, 16]} /><meshStandardMaterial color={color} metalness={0.32} roughness={0.31} /></mesh>
    <Box position={[0.10, 1.05, 0.27]} size={[0.33, 0.14, 0.06]} color="#e9e6e2" metalness={0.7} />
    <Box position={[0.28, 2.11, 0]} size={[0.17, bass ? 2.25 : 1.85, 0.14]} color="#8b6034" />
    <Box position={[0.38, bass ? 3.33 : 3.12, 0]} size={[0.30, 0.37, 0.14]} color="#cda46c" />
    {Array.from({ length: bass ? 4 : 6 }, (_, i) => <Box key={i} position={[0.28 + (i - (bass ? 1.5 : 2.5)) * 0.024, 2.09, 0.087]} size={[0.007, bass ? 2.45 : 2.09, 0.009]} color="#f8fafc" metalness={0.9} />)}
  </group>
}

function Brass() {
  return <group rotation={[0, 0, -0.24]}>
    <Cylinder position={[0, 1.20, 0]} radius={0.075} height={1.6} color="#f6c657" rotation={[0, 0, Math.PI / 2]} />
    <mesh position={[0.82, 1.2, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.43, 0.64, 32, 1, true]} /><meshStandardMaterial color="#eab44f" side={THREE.DoubleSide} metalness={0.85} roughness={0.19} /></mesh>
    {[-0.2, 0, 0.2].map((x) => <Cylinder key={x} position={[x, 1.38, 0.03]} radius={0.04} height={0.43} color="#fff1b1" />)}
    <mesh position={[-0.87, 1.2, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.12, 0.04, 8, 20]} /><meshStandardMaterial color="#f2c96c" metalness={0.85} /></mesh>
  </group>
}

function Woodwind() {
  return <group rotation={[0, 0, -0.35]}>
    <Cylinder position={[0, 1.25, 0]} radius={0.07} height={2.25} color="#14202d" />
    <Cylinder position={[0, 0.18, 0]} radius={0.18} height={0.13} color="#e9d397" />
    {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[0.05, 0.48 + i * 0.2, 0.07]}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color="#cbd5e1" metalness={0.8} /></mesh>)}
  </group>
}

function KeyboardSynth({ color }: { color: string }) {
  return <group>
    <Box position={[0, 0.9, 0]} size={[2.0, 0.2, 0.82]} color={color} />
    {Array.from({ length: 14 }, (_, i) => <Box key={i} position={[-0.86 + i * 0.132, 1.01, 0.10]} size={[0.119, 0.025, 0.53]} color="#f8fafc" />)}
    {Array.from({ length: 10 }, (_, i) => <Box key={i} position={[-0.8 + i * 0.18, 1.04, -0.06]} size={[0.075, 0.05, 0.29]} color="#111827" />)}
    <Cylinder position={[-0.83, 0.40, 0]} radius={0.045} height={0.76} color="#64748b" />
    <Cylinder position={[0.83, 0.40, 0]} radius={0.045} height={0.76} color="#64748b" />
  </group>
}

function Strings({ color }: { color: string }) {
  return <group rotation={[0, 0, 0.15]}>
    <mesh position={[0, 0.80, 0]} castShadow><sphereGeometry args={[0.32, 18, 16]} /><meshStandardMaterial color={color} roughness={0.38} /></mesh>
    <mesh position={[0, 1.25, 0]} castShadow><sphereGeometry args={[0.26, 18, 16]} /><meshStandardMaterial color={color} roughness={0.38} /></mesh>
    <Box position={[0, 2.06, 0]} size={[0.13, 1.36, 0.11]} color="#543315" />
    {[-0.04, 0, 0.04].map((x) => <Box key={x} position={[x, 1.40, 0.10]} size={[0.007, 2.38, 0.007]} color="#f8fafc" metalness={0.8} />)}
    <Box position={[0, 1.12, 0.15]} size={[0.44, 0.075, 0.1]} color="#20170f" />
  </group>
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

function SpaceInstrument({ index, track, notes, position }: { index: number; track: TrackInfo; notes: readonly NoteEvent[]; position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const family = familyFor(track)
  const tint = useStore((s) => s.settings.trackColors[String(index)] ?? s.settings.noteColor)
  useFrame(() => {
    const t = audioEngine.currentMidiTime()
    const pulse = recentStrike(notes, t)
    if (group.current) {
      group.current.scale.setScalar(1 + pulse * 0.09)
      group.current.position.y = position[1] + pulse * 0.22
      group.current.rotation.y = Math.sin(t * 0.6 + index) * 0.025
    }
    if (light.current) light.current.intensity = 0.3 + pulse * 4
  })
  return <group ref={group} position={position}>
    <pointLight ref={light} color={tint} distance={4} intensity={0.5} />
    {family === 'drums' ? <DrumKit color={tint} /> :
      family === 'guitar' || family === 'bass' ? <Guitar color={tint} bass={family === 'bass'} /> :
      family === 'brass' ? <Brass /> : family === 'wind' ? <Woodwind /> :
      family === 'strings' ? <Strings color={tint} /> : <KeyboardSynth color={tint} />}
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
    const tracks = (song?.tracks ?? []).map((track, index) => ({ track, index }))
      .filter(({ track }) => track.hasNotes)
      .slice(0, 8)
    if (tracks.length === 0) {
      return [
        { index: -1, track: { name: 'Drums', percussion: true, channel: 9 } as TrackInfo },
        { index: -2, track: { name: 'Guitar', percussion: false, channel: 0 } as TrackInfo },
        { index: -3, track: { name: 'Trumpet', percussion: false, channel: 0 } as TrackInfo },
      ]
    }
    return tracks
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
      const a = count === 1 ? 0 : -Math.PI * 0.8 + (i / (count - 1)) * Math.PI * 1.6
      const radius = count <= 3 ? 2.15 : 3.2
      return <SpaceInstrument key={index} index={index} track={track} notes={notesByTrack.get(index) ?? []} position={[Math.sin(a) * radius, -1.10, Math.cos(a) * radius]} />
    })}
  </group>
}
