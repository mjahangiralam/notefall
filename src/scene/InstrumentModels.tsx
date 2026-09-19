import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { InstrumentModel } from './instrumentAppearance'

type Vec = [number, number, number]

function Box({ at = [0, 0, 0], size, color, metal = 0, roughness = 0.38, rotation }: {
  at?: Vec; size: Vec; color: string; metal?: number; roughness?: number; rotation?: Vec
}) {
  return <mesh position={at} rotation={rotation} castShadow receiveShadow>
    <boxGeometry args={size} /><meshStandardMaterial color={color} metalness={metal} roughness={roughness} />
  </mesh>
}
function Rod({ at, radius, length, color, rotation = [0, 0, 0], metal = 0.8 }: {
  at: Vec; radius: number; length: number; color: string; rotation?: Vec; metal?: number
}) {
  return <mesh position={at} rotation={rotation} castShadow>
    <cylinderGeometry args={[radius, radius, length, 18]} />
    <meshStandardMaterial color={color} metalness={metal} roughness={0.27} />
  </mesh>
}
function Ball({ at, scale, color, metal = 0 }: { at: Vec; scale: Vec; color: string; metal?: number }) {
  return <mesh position={at} scale={scale} castShadow>
    <sphereGeometry args={[1, 28, 20]} />
    <meshStandardMaterial color={color} metalness={metal} roughness={0.3} />
  </mesh>
}
function Disc({ at, radius, thickness = 0.04, color, rotation = [0, 0, 0] }: {
  at: Vec; radius: number; thickness?: number; color: string; rotation?: Vec
}) {
  return <mesh position={at} rotation={rotation} castShadow>
    <cylinderGeometry args={[radius, radius, thickness, 48]} />
    <meshStandardMaterial color={color} metalness={0.78} roughness={0.22} side={THREE.DoubleSide} />
  </mesh>
}
function Ring({ at, radius, color, rotation = [0, 0, 0], tube = 0.016 }: {
  at: Vec; radius: number; color: string; rotation?: Vec; tube?: number
}) {
  return <mesh position={at} rotation={rotation}>
    <torusGeometry args={[radius, tube, 8, 48]} />
    <meshStandardMaterial color={color} metalness={0.9} roughness={0.2} />
  </mesh>
}

function DrumKit({ tint }: { tint: string }) {
  const shells: Array<{ x: number; y: number; z: number; radius: number; length: number; rotate?: Vec }> = [
    { x: 0, y: 0.36, z: 0.48, radius: 0.59, length: 0.56, rotate: [Math.PI / 2, 0, 0] },
    { x: -0.55, y: 0.72, z: -0.02, radius: 0.30, length: 0.39 },
    { x: 0.55, y: 0.72, z: -0.02, radius: 0.30, length: 0.39 },
    { x: -0.85, y: 0.30, z: 0.48, radius: 0.37, length: 0.45 },
    { x: 0.87, y: 0.31, z: 0.52, radius: 0.38, length: 0.45 },
  ]
  return <group>
    {shells.map((d, i) => <group key={i} position={[d.x, d.y, d.z]} rotation={d.rotate ?? [0, 0, 0]}>
      <Rod at={[0, 0, 0]} radius={d.radius} length={d.length} color={tint} metal={0.25} />
      {([-1, 1] as number[]).map((side) => <group key={side} position={[0, side * d.length / 2, 0]}>
        <Disc at={[0, 0, 0]} radius={d.radius * 0.975} thickness={0.014} color="#f3f1e9" />
        <Ring at={[0, 0.01, 0]} radius={d.radius} color="#cbd5e1" rotation={[Math.PI / 2, 0, 0]} tube={0.028} />
      </group>)}
      {Array.from({ length: 8 }, (_, lug) => {
        const a = lug * Math.PI / 4
        return <Rod key={lug} at={[Math.sin(a) * d.radius, 0, Math.cos(a) * d.radius]} radius={0.013} length={d.length * 0.85} color="#d1d5db" />
      })}
    </group>)}
    <Rod at={[-0.08, 0.53, 0.76]} radius={0.028} length={0.78} color="#aeb8c6" />
    <Disc at={[-0.12, 0.93, 0.76]} radius={0.31} thickness={0.09} color="#f4f4f4" />
    <Rod at={[-0.12, 0.43, 0.76]} radius={0.035} length={0.8} color="#9aa6b3" />
    {[-1.48, 1.48].map((x) => <group key={x}>
      <Rod at={[x, 0.70, -0.36]} radius={0.026} length={1.4} color="#cbd5e1" />
      <Rod at={[x, 0.08, -0.36]} radius={0.018} length={0.7} color="#cbd5e1" rotation={[0, 0, 0.75]} />
      <Disc at={[x, 1.45, -0.36]} radius={0.43} color="#d7ad4a" />
      <Ring at={[x, 1.47, -0.36]} radius={0.31} color="#f9dc83" rotation={[Math.PI / 2, 0, 0]} tube={0.009} />
    </group>)}
    <Rod at={[-0.63, 1.21, 0.6]} radius={0.015} length={0.88} rotation={[0, 0, 0.47]} color="#a77b4b" metal={0} />
    <Rod at={[0.64, 1.18, 0.6]} radius={0.015} length={0.88} rotation={[0, 0, -0.47]} color="#a77b4b" metal={0} />
    <Box at={[0, -0.07, 1.05]} size={[0.27, 0.05, 0.35]} color="#aab5c5" metal={0.7} />
  </group>
}

function guitarGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0.12, 0.27)
  shape.bezierCurveTo(0.45, 0.12, 0.45, -0.12, 0.23, -0.26)
  shape.bezierCurveTo(0.58, -0.52, 0.48, -0.99, 0.0, -1.08)
  shape.bezierCurveTo(-0.49, -0.98, -0.55, -0.57, -0.25, -0.23)
  shape.bezierCurveTo(-0.44, -0.08, -0.37, 0.14, -0.12, 0.28)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.055, bevelThickness: 0.04, curveSegments: 16 })
  geometry.center()
  return geometry
}
function Guitar({ tint, bass = false, acoustic = false }: { tint: string; bass?: boolean; acoustic?: boolean }) {
  const body = useMemo(guitarGeometry, [])
  useEffect(() => () => body.dispose(), [body])
  return <group rotation={[0, 0, -0.16]}>
    <mesh geometry={body} position={[0, 0.9, 0]} scale={[1.15, 1.0, 1.0]} castShadow>
      <meshPhysicalMaterial color={acoustic ? '#a96d32' : tint} metalness={acoustic ? 0 : 0.22} roughness={acoustic ? 0.29 : 0.20} clearcoat={0.65} />
    </mesh>
    <Box at={[0, 1.53, 0.02]} size={[0.19, bass ? 2.45 : 1.9, 0.14]} color="#5f3c21" />
    <Box at={[0, 1.57, 0.105]} size={[0.135, bass ? 2.35 : 1.84, 0.018]} color="#231b15" />
    <Box at={[0.08, bass ? 2.95 : 2.71, 0]} size={[0.25, 0.36, 0.16]} color="#bd8844" rotation={[0, 0, -0.16]} />
    {Array.from({ length: bass ? 4 : 6 }, (_, string) => {
      const count = bass ? 4 : 6
      const x = (string - (count - 1) / 2) * 0.025
      return <group key={string}>
        <Rod at={[x, 1.55, 0.18]} radius={0.0025} length={bass ? 2.82 : 2.39} color="#e7e8e9" />
        <Rod at={[0.19, (bass ? 2.92 : 2.68) + string * 0.038, 0.06]} radius={0.024} length={0.17} color="#cbd5e1" rotation={[0, 0, Math.PI / 2]} />
      </group>
    })}
    {Array.from({ length: 15 }, (_, fret) => <Box key={fret} at={[0, 0.78 + fret * 0.107, 0.123]} size={[0.164, 0.011, 0.015]} color="#ded6b9" metal={0.8} />)}
    {acoustic ? <>
      <Disc at={[0, 0.78, 0.14]} radius={0.165} thickness={0.008} color="#271810" rotation={[Math.PI / 2, 0, 0]} />
      <Ring at={[0, 0.78, 0.15]} radius={0.16} rotation={[0, 0, 0]} color="#f0d0a0" />
      <Box at={[0, 0.27, 0.18]} size={[0.39, 0.09, 0.05]} color="#332418" />
    </> : <>
      <Box at={[0, 0.8, 0.17]} size={[0.41, 0.18, 0.055]} color="#ede8dc" metal={0.45} />
      <Box at={[0, 0.43, 0.17]} size={[0.40, 0.16, 0.055]} color="#ede8dc" metal={0.45} />
      <Box at={[0, 0.19, 0.19]} size={[0.44, 0.12, 0.08]} color="#9199a6" metal={0.85} />
      {[-0.3, -0.2].map((x) => <Disc key={x} at={[x, 0.5, 0.16]} radius={0.045} thickness={0.04} color="#e9d8ab" rotation={[Math.PI / 2, 0, 0]} />)}
    </>}
  </group>
}

function GrandPiano({ tint, electric = false }: { tint: string; electric?: boolean }) {
  if (electric) return <KeyboardRig tint={tint} />
  return <group>
    <Ball at={[0, 0.72, -0.1]} scale={[1.29, 0.18, 0.84]} color={tint} metal={0.24} />
    <Box at={[0, 0.87, 0.54]} size={[2.05, 0.21, 0.47]} color="#171717" metal={0.26} />
    <Box at={[0, 1.19, -0.34]} size={[2.33, 0.065, 1.33]} color="#1d1e20" metal={0.42} rotation={[-0.10, 0, 0.06]} />
    <Rod at={[0.89, 1.00, -0.76]} radius={0.018} length={0.43} color="#ccb074" />
    {[-0.88, 0.88].map((x) => <group key={x}>
      <Rod at={[x, 0.25, 0.49]} radius={0.072} length={0.77} color="#282b30" metal={0.25} />
      <Disc at={[x, -0.14, 0.49]} radius={0.1} color="#bdaa6f" />
    </group>)}
    <Rod at={[0, 0.22, -0.67]} radius={0.073} length={0.76} color="#25272a" metal={0.21} />
    {Array.from({ length: 22 }, (_, key) => <Box key={key} at={[-0.94 + key * 0.088, 1.009, 0.75]} size={[0.083, 0.023, 0.35]} color="#f6f4ea" roughness={0.32} />)}
    {Array.from({ length: 15 }, (_, key) => <Box key={key} at={[-0.89 + key * 0.127, 1.031, 0.62]} size={[0.048, 0.047, 0.22]} color="#111827" />)}
    <Box at={[0, 0.29, 1.17]} size={[1.05, 0.13, 0.36]} color="#18191e" />
    <Rod at={[0, -0.11, 1.17]} radius={0.052} length={0.65} color="#25272a" />
    {[-0.3, 0, 0.3].map((x) => <Box key={x} at={[x, -0.07, 0.72]} size={[0.08, 0.03, 0.32]} color="#d6b35e" metal={0.8} />)}
  </group>
}

function KeyboardRig({ tint, organ = false }: { tint: string; organ?: boolean }) {
  return <group>
    <Box at={[0, 0.87, 0]} size={[2.25, organ ? 0.59 : 0.25, 0.96]} color={tint} metal={0.3} />
    {Array.from({ length: organ ? 2 : 1 }, (_, row) => <group key={row} position={[0, row * 0.15, -row * 0.14]}>
      {Array.from({ length: 24 }, (_, key) => <Box key={key} at={[-1.04 + key * 0.09, 1.01, 0.23]} size={[0.085, 0.02, 0.53]} color="#f1f2e9" />)}
      {Array.from({ length: 17 }, (_, key) => <Box key={key} at={[-0.99 + key * 0.12, 1.04, 0.05]} size={[0.055, 0.052, 0.32]} color="#16191c" />)}
    </group>)}
    {[-0.94, 0.94].map((x) => <Rod key={x} at={[x, 0.35, 0]} radius={0.035} length={0.85} color="#a6afb9" />)}
    {organ && Array.from({ length: 7 }, (_, i) => <Rod key={i} at={[-0.78 + i * 0.26, 1.7 + i * 0.11, -0.36]} radius={0.058} length={0.8 + i * 0.22} color="#c0c7d1" />)}
    {!organ && Array.from({ length: 8 }, (_, i) => <Disc key={i} at={[-0.97 + i * 0.15, 1.015, -0.35]} radius={0.024} thickness={0.01} color={i % 2 ? '#55e4fb' : '#d2d8df'} />)}
  </group>
}

function Violin({ tint, cello = false }: { tint: string; cello?: boolean }) {
  return <group scale={cello ? [1.23, 1.35, 1.15] : [1, 1, 1]} rotation={[0, 0, 0.14]}>
    <Ball at={[0, 0.49, 0]} scale={[0.36, 0.48, 0.16]} color={tint} />
    <Ball at={[0, 0.99, 0]} scale={[0.29, 0.31, 0.14]} color={tint} />
    <Box at={[0, 1.55, 0]} size={[0.15, 0.79, 0.10]} color="#6a3b21" />
    <Box at={[0, 2.0, 0]} size={[0.22, 0.29, 0.13]} color="#6f3c1e" />
    {[-0.25, 0.25].map((x) => <group key={x}>
      <Ball at={[x, 0.77, 0.085]} scale={[0.055, 0.11, 0.015]} color="#392419" />
      <Rod at={[x / 3, 1.93, 0.10]} radius={0.03} length={0.17} color="#c4a676" rotation={[0, 0, Math.PI / 2]} />
    </group>)}
    {Array.from({ length: 4 }, (_, i) => <Rod key={i} at={[-0.055 + i * 0.037, 1.13, 0.18]} radius={0.0026} length={1.57} color="#e5ded1" />)}
    <Box at={[0, 0.70, 0.18]} size={[0.24, 0.07, 0.07]} color="#e0b877" />
    <Box at={[0, 0.29, 0.18]} size={[0.16, 0.19, 0.08]} color="#1e1a15" />
    <Rod at={[-0.66, 1.02, 0.35]} radius={0.012} length={2.02} color="#e9d5a7" metal={0} rotation={[0, 0, -0.30]} />
    {cello && <Rod at={[0, -0.20, 0]} radius={0.026} length={0.5} color="#c3c9d0" />}
  </group>
}

function Harp() {
  return <group>
    <Rod at={[-0.51, 0.76, 0]} radius={0.062} length={2.23} color="#cc9d53" rotation={[0, 0, -0.24]} metal={0.35} />
    <Rod at={[0.46, 0.93, 0]} radius={0.047} length={1.96} color="#ad7740" rotation={[0, 0, 0.44]} metal={0.27} />
    <Rod at={[0.01, 1.83, 0]} radius={0.055} length={1.28} color="#d8b67c" rotation={[0, 0, Math.PI / 2]} metal={0.25} />
    <Box at={[0, -0.23, 0]} size={[1.29, 0.19, 0.46]} color="#c39554" />
    {Array.from({ length: 20 }, (_, i) => <Rod key={i} at={[-0.45 + i * 0.048, 0.64, 0.055]} radius={0.0026} length={1.42 + i * 0.028} color={i % 7 ? '#eee2bb' : '#cc7777'} metal={0.55} />)}
  </group>
}

function Horn({ kind }: { kind: 'trumpet' | 'trombone' | 'tuba' }) {
  const gold = '#e7b94e'
  const bright = '#ffe08b'
  return <group rotation={[0, 0, kind === 'tuba' ? 0 : -0.15]}>
    {kind === 'tuba' ? <>
      <Ring at={[0, 0.74, 0]} radius={0.56} color={gold} rotation={[0, 0, 0]} tube={0.085} />
      <Ring at={[0.12, 0.71, 0.12]} radius={0.41} color={gold} tube={0.06} />
      <Rod at={[0.35, 1.30, 0]} radius={0.11} length={1.2} color={gold} />
      <mesh position={[0.35, 2.0, 0]}><coneGeometry args={[0.54, 0.6, 40, 1, true]} /><meshStandardMaterial color={gold} metalness={0.96} roughness={0.14} side={THREE.DoubleSide} /></mesh>
    </> : <>
      <Rod at={[0, 1.03, 0]} radius={0.064} length={kind === 'trombone' ? 2.6 : 1.55} color={gold} rotation={[0, 0, Math.PI / 2]} />
      <mesh position={[kind === 'trombone' ? 1.29 : 0.85, 1.03, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[kind === 'trombone' ? 0.38 : 0.43, 0.66, 40, 1, true]} />
        <meshStandardMaterial color={gold} metalness={0.95} roughness={0.16} side={THREE.DoubleSide} />
      </mesh>
      <Ring at={[-0.60, 0.98, 0]} radius={0.22} color={gold} tube={0.045} />
      <Rod at={[-0.65, 0.99, 0.0]} radius={0.047} length={0.22} color="#d5d7da" rotation={[0, 0, Math.PI / 2]} />
      {kind === 'trombone' && <>
        <Rod at={[0.05, 0.79, 0.19]} radius={0.026} length={2.0} color={bright} rotation={[0, 0, Math.PI / 2]} />
        <Rod at={[0.05, 0.70, 0.19]} radius={0.026} length={2.0} color={bright} rotation={[0, 0, Math.PI / 2]} />
        <Rod at={[1.03, 0.74, 0.19]} radius={0.03} length={0.13} color={bright} />
      </>}
    </>}
    {kind !== 'trombone' && [0, 1, 2].map((i) => <group key={i}>
      <Rod at={[-0.25 + i * 0.21, 1.16, 0.13]} radius={0.041} length={0.35} color={gold} />
      <Disc at={[-0.25 + i * 0.21, 1.37, 0.13]} radius={0.08} color={bright} />
    </group>)}
  </group>
}

function Wind({ kind }: { kind: 'saxophone' | 'clarinet' | 'oboe' | 'flute' | 'bagpipe' }) {
  if (kind === 'bagpipe') return <group>
    <Ball at={[0, 0.67, 0]} scale={[0.64, 0.45, 0.42]} color="#5c2b39" />
    {[-0.3, 0, 0.3].map((x, i) => <Rod key={x} at={[x, 1.50 + i * 0.12, -0.16]} radius={0.045} length={1.50 + i * 0.2} color="#352a22" />)}
    <Rod at={[0.46, 0.52, 0.3]} radius={0.041} length={0.95} color="#473323" rotation={[0, 0, -0.48]} />
  </group>
  if (kind === 'saxophone') return <group rotation={[0, 0, -0.2]}>
    <Rod at={[0.0, 0.9, 0]} radius={0.083} length={1.45} color="#d5a947" rotation={[0, 0, 0.26]} />
    <Ring at={[0.14, 0.3, 0]} radius={0.24} color="#d9b35d" tube={0.071} />
    <mesh position={[0.39, 0.20, 0]} rotation={[0, 0, -0.7]}><coneGeometry args={[0.29, 0.52, 36, 1, true]} /><meshStandardMaterial color="#e6bb59" metalness={0.96} roughness={0.18} side={THREE.DoubleSide} /></mesh>
    <Rod at={[-0.28, 1.57, 0]} radius={0.047} length={0.55} color="#d5a947" rotation={[0, 0, -0.7]} />
    {Array.from({ length: 10 }, (_, i) => <Disc key={i} at={[0.16 - i * 0.025, 0.55 + i * 0.12, 0.10]} radius={0.066} thickness={0.02} color="#f5d989" rotation={[Math.PI / 2, 0, 0]} />)}
  </group>
  if (kind === 'flute') return <group rotation={[0, 0, 0.07]}>
    <Rod at={[0, 0.91, 0]} radius={0.052} length={2.25} color="#d8e1e9" rotation={[0, 0, Math.PI / 2]} />
    {Array.from({ length: 13 }, (_, i) => <Disc key={i} at={[-0.94 + i * 0.16, 0.94, 0.04]} radius={0.052} thickness={0.014} color="#f6f7f8" rotation={[Math.PI / 2, 0, 0]} />)}
    <Box at={[-1.09, 0.93, 0]} size={[0.06, 0.15, 0.1]} color="#96a7b9" metal={0.85} />
  </group>
  return <group rotation={[0, 0, -0.28]}>
    <Rod at={[0, 0.95, 0]} radius={kind === 'oboe' ? 0.052 : 0.064} length={2.10} color={kind === 'oboe' ? '#5d3e2a' : '#1b2129'} metal={0.14} />
    <Disc at={[0, -0.13, 0]} radius={0.15} thickness={0.13} color="#d2bd83" />
    {Array.from({ length: 12 }, (_, i) => <Disc key={i} at={[0.045, 0.2 + i * 0.14, 0.065]} radius={0.044} thickness={0.017} color="#cbd5e1" rotation={[Math.PI / 2, 0, 0]} />)}
    <Rod at={[0, 2.05, 0]} radius={0.028} length={0.26} color={kind === 'oboe' ? '#dfb47c' : '#171717'} metal={0.1} />
  </group>
}

function Accordion() {
  return <group>
    <Box at={[-0.38, 0.88, 0]} size={[0.45, 0.95, 0.45]} color="#a92933" metal={0.1} />
    <Box at={[0.37, 0.88, 0]} size={[0.45, 0.95, 0.45]} color="#a92933" metal={0.1} />
    {Array.from({ length: 8 }, (_, i) => <Box key={i} at={[-0.18 + i * 0.053, 0.88, 0]} size={[0.022, 0.84, 0.40]} color={i % 2 ? '#333333' : '#d1d3d8'} />)}
    {Array.from({ length: 13 }, (_, i) => <Box key={i} at={[0.62, 0.47 + i * 0.068, 0.13]} size={[0.05, 0.055, 0.16]} color="#f8fafc" />)}
    {Array.from({ length: 10 }, (_, i) => <Disc key={i} at={[-0.61, 0.49 + i * 0.08, 0.15]} radius={0.024} color="#dedce0" rotation={[Math.PI / 2, 0, 0]} />)}
  </group>
}

function Mallets({ bells = false }: { bells?: boolean }) {
  return <group>
    <Rod at={[-0.74, 0.25, 0]} radius={0.043} length={0.96} color="#8a929d" />
    <Rod at={[0.74, 0.25, 0]} radius={0.043} length={0.96} color="#8a929d" />
    <Box at={[0, 0.8, 0]} size={[1.85, 0.11, 0.6]} color="#363f4a" />
    {Array.from({ length: 14 }, (_, i) => <Box key={i} at={[-0.83 + i * 0.13, 0.90, 0]} size={[0.106, 0.07, 0.34 + i * 0.018]} color={bells ? '#cfd6df' : '#8d5e38'} metal={bells ? 0.85 : 0} />)}
    {[-0.35, 0.35].map((x) => <group key={x}>
      <Rod at={[x, 1.2, -0.22]} radius={0.022} length={1.08} color="#c4a473" rotation={[0, 0, 0.56]} metal={0.05} />
      <Ball at={[x + 0.29, 1.58, -0.22]} scale={[0.08, 0.08, 0.08]} color="#e2e8f0" />
    </group>)}
  </group>
}

function StudioRig({ voice = false }: { voice?: boolean }) {
  return <group>
    <Box at={[0, 0.6, 0]} size={[1.65, 0.24, 0.78]} color="#313c4a" metal={0.25} rotation={[-0.14, 0, 0]} />
    {Array.from({ length: 9 }, (_, i) => <group key={i}>
      <Box at={[-0.72 + i * 0.18, 0.75, 0.1]} size={[0.05, 0.018, 0.32]} color="#111827" />
      <Box at={[-0.72 + i * 0.18, 0.77, 0.03 + (i % 3) * 0.06]} size={[0.07, 0.026, 0.055]} color={i % 2 ? '#8dfbd4' : '#f9a8d4'} />
    </group>)}
    {[-0.64, 0.64].map((x) => <Rod key={x} at={[x, 0.22, 0.0]} radius={0.028} length={0.76} color="#a4abb9" />)}
    {voice ? <>
      <Rod at={[0, 1.15, -0.33]} radius={0.037} length={1.55} color="#adb4c0" />
      <Ball at={[0, 1.98, -0.33]} scale={[0.13, 0.22, 0.13]} color="#b4becb" metal={0.75} />
      <Ring at={[0, 1.88, -0.10]} radius={0.18} color="#2a3544" tube={0.023} />
    </> : <>
      <Box at={[-1.09, 0.97, -0.23]} size={[0.39, 0.95, 0.36]} color="#1d2027" />
      <Disc at={[-1.09, 1.02, 0]} radius={0.145} color="#6b7280" rotation={[Math.PI / 2, 0, 0]} />
      <Box at={[1.09, 0.97, -0.23]} size={[0.39, 0.95, 0.36]} color="#1d2027" />
      <Disc at={[1.09, 1.02, 0]} radius={0.145} color="#6b7280" rotation={[Math.PI / 2, 0, 0]} />
    </>}
  </group>
}

export function InstrumentModelMesh({ model, tint }: { model: InstrumentModel; tint: string }) {
  switch (model) {
    case 'drums': return <DrumKit tint={tint} />
    case 'grandPiano': return <GrandPiano tint={tint} />
    case 'electricPiano': return <GrandPiano tint={tint} electric />
    case 'organ': return <KeyboardRig tint={tint} organ />
    case 'guitar': return <Guitar tint={tint} />
    case 'bass': return <Guitar tint={tint} bass />
    case 'violin': return <Violin tint={tint} />
    case 'cello': return <Violin tint={tint} cello />
    case 'harp': return <Harp />
    case 'trumpet': return <Horn kind="trumpet" />
    case 'trombone': return <Horn kind="trombone" />
    case 'tuba': return <Horn kind="tuba" />
    case 'saxophone': return <Wind kind="saxophone" />
    case 'clarinet': return <Wind kind="clarinet" />
    case 'oboe': return <Wind kind="oboe" />
    case 'flute': return <Wind kind="flute" />
    case 'bagpipe': return <Wind kind="bagpipe" />
    case 'accordion': return <Accordion />
    case 'mallets': return <Mallets />
    case 'bells': return <Mallets bells />
    case 'choir': return <StudioRig voice />
    case 'fx': return <StudioRig />
    case 'synth': return <KeyboardRig tint={tint} />
  }
}
