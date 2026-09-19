import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audioEngine } from '../audio/engine'
import type { NoteEvent, ParsedSong } from '../midi/types'
import { buildScoreParts, paginateScoreParts, type ScoreClef, type ScorePart } from './scoreLayout'

const W = 1600
const H = 900
const LEFT = 335
const RIGHT = 1520
const MEASURES = 2
const MEASURE_W = (RIGHT - LEFT) / MEASURES
const STEP = 7
const STAFF_SPACING = 118
const STAFF_TOP = 270
const NATURAL = [0, 2, 4, 5, 7, 9, 11]

export function ScoreCamera() {
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    camera.position.set(0, 0, 13.25)
    if ('fov' in camera) {
      const c = camera as THREE.PerspectiveCamera
      if (c.fov !== 32) { c.fov = 32; c.updateProjectionMatrix() }
    }
    camera.lookAt(0, 0, 0)
  })
  return null
}

function staffStep(midi: number): { step: number; sharp: boolean } {
  const octave = Math.floor(midi / 12) - 1
  const pc = ((midi % 12) + 12) % 12
  let letter = NATURAL.findIndex((n) => n === pc)
  const sharp = letter < 0
  if (sharp) letter = NATURAL.findIndex((n) => n === pc - 1)
  return { step: octave * 7 + letter, sharp }
}

function staffY(midi: number, clef: ScoreClef, bottom: number): number {
  const base = clef === 'bass' ? 2 * 7 + 4 : 4 * 7 + 2 // G2 or E4
  return bottom - (staffStep(midi).step - base) * STEP
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = '#526173', width = 2) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function drawRest(ctx: CanvasRenderingContext2D, x: number, yBottom: number) {
  ctx.fillStyle = '#273347'
  ctx.fillRect(x - 10, yBottom - 2 * STEP - 5, 20, 6)
}

function drawPercussionNote(ctx: CanvasRenderingContext2D, note: NoteEvent, x: number, bottom: number, active: boolean) {
  // Standard five-line percussion staff: kick low, snare centre, cymbals high.
  const pitch = note.midi
  const y = bottom - (pitch === 35 || pitch === 36 ? 0 : pitch === 38 || pitch === 40 ? 2 :
    pitch >= 49 || pitch === 42 || pitch === 44 || pitch === 46 ? 5 : 3) * STEP
  ctx.strokeStyle = active ? '#0369a1' : '#263449'
  ctx.lineWidth = 3
  if (pitch >= 49 || pitch === 42 || pitch === 44 || pitch === 46) {
    line(ctx, x - 8, y - 7, x + 8, y + 7, ctx.strokeStyle as string, 3)
    line(ctx, x - 8, y + 7, x + 8, y - 7, ctx.strokeStyle as string, 3)
  } else {
    ctx.beginPath()
    ctx.ellipse(x, y, 10, 7, -0.2, 0, Math.PI * 2)
    ctx.fillStyle = active ? '#0284c7' : '#263449'
    ctx.fill()
  }
  line(ctx, x + 9, y, x + 9, y - 38, active ? '#0284c7' : '#263449', 2)
}

function drawNote(ctx: CanvasRenderingContext2D, note: NoteEvent, x: number, clef: ScoreClef, bottom: number, active: boolean, beat: number) {
  if (clef === 'percussion') { drawPercussionNote(ctx, note, x, bottom, active); return }
  let pitch = note.midi
  // Keep extreme pitches visible and mark octave displacement, rather than
  // dropping them completely or drawing into another instrument's staff.
  let octaves = 0
  while (staffY(pitch, clef, bottom) < bottom - 70 && octaves < 4) { pitch -= 12; octaves++ }
  while (staffY(pitch, clef, bottom) > bottom + 29 && octaves > -4) { pitch += 12; octaves-- }
  const y = staffY(pitch, clef, bottom)
  const color = active ? '#0369a1' : '#1e293b'
  const duration = note.duration / beat
  const whole = duration >= 3.5
  const half = duration >= 1.75
  for (let py = bottom + 2 * STEP; py <= y + 1; py += 2 * STEP) line(ctx, x - 15, py, x + 15, py)
  for (let py = bottom - 10 * STEP; py >= y - 1; py -= 2 * STEP) line(ctx, x - 15, py, x + 15, py)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.24)
  ctx.beginPath()
  ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  if (whole || half) ctx.stroke()
  else ctx.fill()
  ctx.restore()
  if (!whole) {
    const up = y >= bottom - 4 * STEP
    const sx = x + (up ? 9 : -9)
    const tip = y + (up ? -40 : 40)
    line(ctx, sx, y, sx, tip, color, 2)
    if (duration < 0.75) {
      ctx.strokeStyle = color
      ctx.beginPath()
      ctx.moveTo(sx, tip)
      ctx.quadraticCurveTo(sx + 18, tip + (up ? 7 : -7), sx + 12, tip + (up ? 20 : -20))
      ctx.stroke()
    }
  }
  if (staffStep(pitch).sharp) {
    ctx.font = '22px Georgia, serif'
    ctx.fillStyle = color
    ctx.fillText('♯', x - 25, y + 6)
  }
  if (octaves) {
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillStyle = color
    ctx.fillText(octaves > 0 ? '8va' : '8vb', x - 11, y - 16)
  }
}

function isOnStaff(note: NoteEvent, part: ScorePart, clef: ScoreClef) {
  if (note.track !== part.trackIndex) return false
  if (clef === 'percussion') return true
  if (part.clefs.length === 1) return true
  return clef === 'treble' ? note.midi >= 60 : note.midi < 60
}

/** A part stays on its own stave(s). Multi-instrument MIDIs are arranged
 * as a conductor score, never collapsed into a misleading piano reduction. */
function paintScore(ctx: CanvasRenderingContext2D, song: ParsedSong | null, t: number, partPage: number) {
  ctx.fillStyle = '#f8f7f3'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#e7edf2'
  ctx.fillRect(0, 0, W, 136)
  ctx.fillStyle = '#152033'
  ctx.font = 'bold 35px Georgia, serif'
  ctx.fillText(song?.name?.replace(/\.midi?$/i, '') || 'No MIDI loaded', 66, 57, 1370)
  const bpm = Math.max(20, Math.min(300, song?.notation?.bpm || 120))
  const numerator = Math.max(1, Math.min(12, song?.notation?.numerator || 4))
  const denominator = [1, 2, 4, 8, 16].includes(song?.notation?.denominator || 4) ? (song?.notation?.denominator || 4) : 4
  const beat = 60 / bpm
  const bar = beat * numerator * 4 / denominator
  const first = Math.max(0, Math.floor(t / (bar * MEASURES)) * MEASURES)
  const parts = buildScoreParts(song)
  const pages = paginateScoreParts(parts)
  const page = Math.min(Math.max(0, partPage), pages.length - 1)
  const shown = pages[page]
  const firstPart = shown[0] ? parts.indexOf(shown[0]) + 1 : 0
  ctx.font = '20px system-ui, sans-serif'
  ctx.fillStyle = '#42526a'
  ctx.fillText(`${numerator}/${denominator}  ·  ♩ = ${Math.round(bpm)}  ·  Measures ${first + 1}–${first + MEASURES}`, 68, 102)
  ctx.textAlign = 'right'
  ctx.fillText(`Parts ${firstPart}–${firstPart + shown.length - 1} of ${parts.length} · Page ${page + 1}/${pages.length}`, 1510, 102)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'
  ctx.fillRect(42, 148, 1516, 645)
  const local = Math.max(0, Math.min(MEASURES * bar, t - first * bar))
  ctx.fillStyle = '#e6f2ff'
  ctx.fillRect(LEFT + Math.min(MEASURES - 1, Math.floor(local / bar)) * MEASURE_W, 157, MEASURE_W, 620)
  let staveIndex = 0
  for (const part of shown) {
    for (const clef of part.clefs) {
      const bottom = STAFF_TOP + staveIndex * STAFF_SPACING
      const top = bottom - 8 * STEP
      for (let j = 0; j < 5; j++) line(ctx, LEFT - 72, bottom - 2 * STEP * j, RIGHT, bottom - 2 * STEP * j)
      ctx.fillStyle = '#202b3a'
      ctx.font = '17px system-ui, sans-serif'
      ctx.fillText(part.label.slice(0, 27), 54, bottom - 28, 187)
      if (part.clefs.length > 1) {
        ctx.font = '13px system-ui, sans-serif'
        ctx.fillStyle = '#64748b'
        ctx.fillText(clef === 'treble' ? 'Right hand' : 'Left hand', 54, bottom - 8)
      }
      ctx.fillStyle = '#243449'
      ctx.font = '58px "Bravura", "Apple Symbols", "Segoe UI Symbol", serif'
      ctx.fillText(clef === 'treble' ? '𝄞' : clef === 'bass' ? '𝄢' : '𝄥', LEFT - 66, bottom + 7)
      for (let j = 0; j <= MEASURES; j++) {
        const x = LEFT + j * MEASURE_W
        line(ctx, x, top, x, bottom)
      }
      for (let m = 0; m < MEASURES; m++) {
        const start = (first + m) * bar
        const end = start + bar
        const measureNotes = part.notes.filter((n) => isOnStaff(n, part, clef) && n.time < end && n.time + n.duration > start)
        if (!measureNotes.length) drawRest(ctx, LEFT + m * MEASURE_W + MEASURE_W / 2, bottom)
        const dedupe = new Set<string>()
        for (const note of measureNotes) {
          const timing = Math.max(0, note.time - start)
          const quantum = beat / 4
          const quantized = Math.min(bar - quantum, Math.round(timing / quantum) * quantum)
          const x = LEFT + m * MEASURE_W + 44 + (quantized / bar) * (MEASURE_W - 77)
          const key = `${note.id}:${m}:${clef}`
          if (dedupe.has(key)) continue
          dedupe.add(key)
          drawNote(ctx, note, x, clef, bottom, note.time <= t && t < note.time + Math.max(0.12, note.duration), beat)
        }
      }
      if (part.clefs.length > 1 && clef === 'treble') {
        // Connect the two staves of a single instrument with a left brace.
        ctx.strokeStyle = '#344054'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(LEFT - 87, bottom - 8 * STEP)
        ctx.quadraticCurveTo(LEFT - 105, bottom + 6, LEFT - 87, bottom + STAFF_SPACING + 4)
        ctx.stroke()
      }
      staveIndex++
    }
  }
  if (!song || !parts.length) {
    ctx.font = '28px system-ui, sans-serif'
    ctx.fillStyle = '#66758b'
    ctx.fillText('Open a MIDI file to see separate instrument parts.', 365, 475)
  }
  const playheadX = LEFT + Math.min(MEASURES * MEASURE_W, local / bar * MEASURE_W)
  line(ctx, playheadX, 166, playheadX, 781, '#0284c7', 3)
  ctx.fillStyle = '#485870'
  ctx.font = '20px system-ui, sans-serif'
  ctx.fillText(pages.length > 1 ? 'PageUp / PageDown: change instrument part page' : 'Follow score · live playback', 66, 832)
  ctx.font = '17px system-ui, sans-serif'
  ctx.fillText('MIDI transcription: first tempo/meter, quantized notes; advanced notation, tuplets and key changes need music-engraving software.', 66, 865, 1470)
}

export function ScoreView() {
  const song = useStore((s) => s.song)
  const [partPage, setPartPage] = useState(0)
  const { texture, ctx } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Sheet music requires 2D canvas support')
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return { texture: tex, ctx: context }
  }, [])
  const previous = useRef({ time: Number.NaN, page: -1 })
  const pages = useMemo(() => paginateScoreParts(buildScoreParts(song)).length, [song])
  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => { setPartPage(0); previous.current.time = Number.NaN }, [song])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null
      if (el?.closest('input, textarea, [contenteditable="true"]')) return
      if (event.key === 'PageDown') { event.preventDefault(); setPartPage((n) => Math.min(pages - 1, n + 1)) }
      if (event.key === 'PageUp') { event.preventDefault(); setPartPage((n) => Math.max(0, n - 1)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages])
  useFrame(() => {
    const time = Math.max(0, audioEngine.currentMidiTime())
    if (previous.current.page === partPage && Math.abs(time - previous.current.time) < 1 / 60) return
    previous.current = { time, page: partPage }
    paintScore(ctx, song, time, partPage)
    texture.needsUpdate = true
  })
  return (
    <mesh position={[0, 0, 0]} raycast={() => null}>
      <planeGeometry args={[12, 6.75]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}
