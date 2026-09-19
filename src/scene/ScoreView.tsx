import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audioEngine } from '../audio/engine'
import type { NoteEvent, ParsedSong } from '../midi/types'

const W = 1600
const H = 900
const LEFT = 132
const RIGHT = 1490
const MEASURES = 4
const MEASURE_W = (RIGHT - LEFT) / MEASURES
const STEP = 12
const NATURAL = [0, 2, 4, 5, 7, 9, 11]

/** A predictable score camera, separate from the piano's automated camera. */
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

function staffY(midi: number, bass: boolean): number {
  // E4 is the treble bottom line; G2 is the bass bottom line.
  const base = bass ? 2 * 7 + 4 : 4 * 7 + 2
  return (bass ? 615 : 390) - (staffStep(midi).step - base) * STEP
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 2) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function drawStaves(ctx: CanvasRenderingContext2D, yBottom: number, label: string) {
  for (let i = 0; i < 5; i++) {
    line(ctx, LEFT - 50, yBottom - i * STEP * 2, RIGHT, yBottom - i * STEP * 2, '#748092', 2)
  }
  ctx.fillStyle = '#243249'
  ctx.font = 'bold 36px Georgia, serif'
  ctx.fillText(label, 44, yBottom - 126)
  // Clef drawn as a legible text glyph if the platform has a music font.
  ctx.font = '80px "Bravura", "Apple Symbols", "Segoe UI Symbol", serif'
  ctx.fillStyle = '#1e293b'
  ctx.fillText(label === 'Treble' ? '𝄞' : '𝄢', 73, yBottom - 18)
}

function drawNote(ctx: CanvasRenderingContext2D, note: NoteEvent, x: number, bass: boolean, active: boolean, beat: number) {
  const y = staffY(note.midi, bass)
  // Extremely high/low pitches remain within a compact notation panel.
  if (y < (bass ? 435 : 200) || y > (bass ? 715 : 490)) return
  const base = bass ? 615 : 390
  ctx.strokeStyle = active ? '#0ea5e9' : '#17233a'
  ctx.fillStyle = active ? '#0284c7' : '#17233a'
  const duration = note.duration / beat
  const whole = duration >= 3.5
  const half = duration >= 1.75
  // Ledger lines (outside the five-line staff).
  for (let py = base + 24; py <= y + 1; py += 24) line(ctx, x - 19, py, x + 19, py, '#64748b', 2)
  for (let py = base - 120; py >= y - 1; py -= 24) line(ctx, x - 19, py, x + 19, py, '#64748b', 2)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.25)
  ctx.beginPath()
  ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2)
  if (!whole && !half) ctx.fill()
  else { ctx.lineWidth = 3; ctx.stroke() }
  ctx.restore()
  if (!whole) {
    const up = y >= base - 48
    const stemX = x + (up ? 11 : -11)
    const tip = y + (up ? -61 : 61)
    line(ctx, stemX, y, stemX, tip, active ? '#0284c7' : '#17233a', 3)
    if (duration < 0.75) {
      ctx.beginPath()
      ctx.moveTo(stemX, tip)
      ctx.quadraticCurveTo(stemX + 24, tip + (up ? 8 : -8), stemX + 12, tip + (up ? 30 : -30))
      ctx.stroke()
    }
  }
  if (staffStep(note.midi).sharp) {
    ctx.fillStyle = active ? '#0284c7' : '#334155'
    ctx.font = '24px Georgia, serif'
    ctx.fillText('♯', x - 31, y + 7)
  }
}

function firstVisibleIndex(notes: NoteEvent[], start: number) {
  let lo = 0, hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (notes[mid].time < start) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Four-measure, quantized score preview. Drawn into a THREE.CanvasTexture so
 * the exact same R3F useFrame updates both the preview and encoded MP4. */
function paintScore(ctx: CanvasRenderingContext2D, song: ParsedSong | null, t: number) {
  ctx.fillStyle = '#f7f5ef'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#e2e8f0'
  ctx.fillRect(0, 0, W, 112)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 38px Georgia, serif'
  ctx.fillText(song?.name?.replace(/\.midi?$/i, '') || 'No MIDI loaded', 82, 62, 1320)
  ctx.font = '21px system-ui, sans-serif'
  ctx.fillStyle = '#475569'
  const bpm = Math.max(20, Math.min(300, song?.notation?.bpm || 120))
  const numerator = Math.max(1, Math.min(12, song?.notation?.numerator || 4))
  const denominator = [1, 2, 4, 8, 16].includes(song?.notation?.denominator || 4) ? (song?.notation?.denominator || 4) : 4
  const beat = 60 / bpm
  const bar = beat * numerator * 4 / denominator
  const first = Math.max(0, Math.floor(t / (bar * MEASURES)) * MEASURES)
  ctx.fillText(`${numerator}/${denominator}  ·  ♩ = ${Math.round(bpm)}  ·  Measures ${first + 1}–${first + MEASURES}`, 85, 96)
  ctx.fillStyle = '#64748b'
  ctx.textAlign = 'right'
  ctx.fillText('Approximate MIDI score · eighth-note timing grid', 1510, 96)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#eef2f7'
  ctx.fillRect(45, 145, 1510, 620)
  const local = Math.max(0, Math.min(MEASURES * bar, t - first * bar))
  const activeMeasure = Math.min(MEASURES - 1, Math.floor(local / bar))
  ctx.fillStyle = '#dbeafe'
  ctx.fillRect(LEFT + activeMeasure * MEASURE_W, 188, MEASURE_W, 510)
  drawStaves(ctx, 390, 'Treble')
  drawStaves(ctx, 615, 'Bass')
  for (let j = 0; j <= MEASURES; j++) {
    const x = LEFT + j * MEASURE_W
    line(ctx, x, 294, x, 390, '#64748b', 2)
    line(ctx, x, 519, x, 615, '#64748b', 2)
    if (j < MEASURES) {
      ctx.fillStyle = '#64748b'
      ctx.font = '22px system-ui, sans-serif'
      ctx.fillText(String(first + j + 1), x + 12, 228)
    }
  }
  if (song) {
    const begin = first * bar
    const end = begin + MEASURES * bar
    const notes = song.notes
    const seen = new Set<string>()
    let percussionCount = 0
    for (let i = firstVisibleIndex(notes, begin); i < notes.length && notes[i].time < end; i++) {
      const note = notes[i]
      const track = song.tracks[note.track]
      if (track?.percussion || track?.channel === 9) { percussionCount++; continue }
      const quantized = Math.round((note.time - begin) / (beat / 2)) * (beat / 2)
      const measure = Math.min(MEASURES - 1, Math.max(0, Math.floor(quantized / bar)))
      const frac = (quantized - measure * bar) / bar
      const x = LEFT + measure * MEASURE_W + 24 + frac * (MEASURE_W - 51)
      const bass = note.midi < 60
      const key = `${measure}:${Math.round(frac * 32)}:${note.midi}:${bass}`
      if (seen.has(key)) continue
      seen.add(key)
      drawNote(ctx, note, x, bass, note.time <= t && t < note.time + Math.max(0.13, note.duration), beat)
    }
    if (percussionCount) {
      ctx.fillStyle = '#475569'
      ctx.font = '21px system-ui, sans-serif'
      ctx.fillText(`Percussion: ${percussionCount} events in this view`, 80, 744)
    }
  } else {
    ctx.fillStyle = '#64748b'
    ctx.font = '32px system-ui, sans-serif'
    ctx.fillText('Open a MIDI file to see its notation.', 325, 455)
  }
  const playheadX = LEFT + Math.min(MEASURES * MEASURE_W, local / bar * MEASURE_W)
  line(ctx, playheadX, 185, playheadX, 690, '#0284c7', 4)
  ctx.fillStyle = '#475569'
  ctx.font = '22px system-ui, sans-serif'
  ctx.fillText('Preview transcription: simple meter and initial tempo; complex tuplets, key changes and expressive timing are not fully engraved.', 82, 845, 1440)
}

export function ScoreView() {
  const song = useStore((s) => s.song)
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
  const previousTime = useRef(Number.NaN)
  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => { previousTime.current = Number.NaN }, [song])
  useFrame(() => {
    const time = Math.max(0, audioEngine.currentMidiTime())
    if (Math.abs(time - previousTime.current) < 1 / 60) return
    previousTime.current = time
    paintScore(ctx, song, time)
    texture.needsUpdate = true
  })
  return (
    <mesh position={[0, 0, 0]} raycast={() => null}>
      <planeGeometry args={[12, 6.75]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}
