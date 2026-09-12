import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useCurrentDisplayTime } from '../audio/useCurrentTime'
import {
  expressionAt,
  normalizeExpressionPoints,
  type ExpressionPoint,
} from '../midi/expressionMap'

const HEADER_WIDTH = 112
const ROW_GAP = 4
const LANE_HEIGHT = 48
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * Full-song MIDI CC11 editor. It deliberately lives beside the existing
 * timeline instead of pretending expression is a visual setting: edits mutate
 * ParsedSong.expressions, so Undo/Redo, .nfz persistence, and MIDI round-trip
 * all treat dynamics as part of the music.
 */
export function ExpressionAutomationLane() {
  const song = useStore((s) => s.song)
  const midiOffsetSec = useStore((s) => s.settings.midiOffsetSec)
  const displayTime = useCurrentDisplayTime()
  const laneRef = useRef<HTMLDivElement | null>(null)
  const [draft, setDraft] = useState<ExpressionPoint[] | null>(null)
  const dragRef = useRef<{ index: number; snapshot: ExpressionPoint[] } | null>(
    null,
  )

  const sourcePoints = song?.expressions ?? []
  const points = draft ?? sourcePoints
  const duration = Math.max(0.001, song?.duration ?? 0.001)
  const currentMidiTime = Math.max(0, displayTime - midiOffsetSec)
  const currentExpression = expressionAt(points, currentMidiTime)

  const curvePoints = useMemo(() => {
    if (!song) return [] as ExpressionPoint[]
    if (points.length === 0) {
      return [
        { time: 0, value: 1 },
        { time: duration, value: 1 },
      ]
    }
    const out: ExpressionPoint[] = [
      { time: 0, value: expressionAt(points, 0) },
    ]
    for (const p of points) {
      if (p.time > 0 && p.time < duration) out.push(p)
    }
    out.push({ time: duration, value: expressionAt(points, duration) })
    return out
  }, [song, points, duration])

  const commit = (next: readonly ExpressionPoint[]) => {
    if (!song) return
    const normalized = normalizeExpressionPoints(next)
    useStore.getState().applySongEdit((prev) => ({
      ...prev,
      expressions: normalized,
    }))
  }

  const pointFromPointer = (clientX: number, clientY: number) => {
    const rect = laneRef.current?.getBoundingClientRect()
    if (!rect) return { time: 0, value: 1 }
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top))
    return {
      time: (x / Math.max(1, rect.width)) * duration,
      value: clamp01(1 - y / Math.max(1, rect.height)),
    }
  }

  const onLanePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!song || e.button !== 0 || dragRef.current) return
    const p = pointFromPointer(e.clientX, e.clientY)
    commit([...sourcePoints, p])
  }

  const onDotPointerDown =
    (index: number) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const snapshot = sourcePoints.map((p) => ({ ...p }))
      setDraft(snapshot)
      dragRef.current = { index, snapshot }
      e.currentTarget.setPointerCapture(e.pointerId)
    }

  const onDotPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    if ((e.buttons & 1) === 0) {
      onDotPointerUp(e)
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const p = pointFromPointer(e.clientX, e.clientY)
    const prevTime = drag.index > 0 ? drag.snapshot[drag.index - 1].time : 0
    const nextTime =
      drag.index < drag.snapshot.length - 1
        ? drag.snapshot[drag.index + 1].time
        : duration
    const next = drag.snapshot.map((v) => ({ ...v }))
    next[drag.index] = {
      time: Math.max(prevTime, Math.min(nextTime, p.time)),
      value: p.value,
    }
    setDraft(next)
  }

  const onDotPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    e.preventDefault()
    e.stopPropagation()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* capture may already be released */
    }
    const next = draft ?? drag.snapshot
    dragRef.current = null
    setDraft(null)
    commit(next)
  }

  const onRemove =
    (index: number) => (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const next = sourcePoints.slice()
      next.splice(index, 1)
      commit(next)
    }

  const onResetPoint =
    (index: number) => (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (Math.abs(sourcePoints[index].value - 1) < 1e-6) return
      const next = sourcePoints.slice()
      next[index] = { ...next[index], value: 1 }
      commit(next)
    }

  if (!song) return null

  const path = curvePoints
    .map((p) => {
      const x = (p.time / duration) * 100
      const y = (1 - p.value) * LANE_HEIGHT
      return `${x},${y}`
    })
    .join(' ')
  const playheadPct = Math.max(0, Math.min(100, (currentMidiTime / duration) * 100))

  return (
    <div className="relative flex w-full select-none" style={{ gap: ROW_GAP }}>
      <div
        className="flex shrink-0 flex-col justify-center rounded bg-neutral-900/60 px-2 ring-1 ring-white/5"
        style={{ width: HEADER_WIDTH, height: LANE_HEIGHT }}
      >
        <span className="text-[11px] font-medium text-neutral-200">Dynamics</span>
        <span className="font-mono text-[9px] text-neutral-500">CC11 Expression</span>
      </div>
      <div
        ref={laneRef}
        onPointerDown={onLanePointerDown}
        className="relative min-w-0 flex-1 cursor-crosshair overflow-hidden rounded bg-neutral-900/40"
        style={{ height: LANE_HEIGHT, touchAction: 'none' }}
        aria-label="Dynamics and MIDI CC11 expression automation"
        title="Click to add a dynamics point. Drag points to shape crescendos and diminuendos. Right-click removes a point; double-click resets it to 100%."
      >
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <div
            key={v}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-white/[0.06]"
            style={{ top: `${(1 - v) * 100}%` }}
          />
        ))}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 100 ${LANE_HEIGHT}`}
        >
          <polyline
            points={path}
            fill="none"
            stroke="rgba(167,139,250,0.95)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map((p, i) => {
          if (p.time < 0 || p.time > duration) return null
          const x = (p.time / duration) * 100
          const y = (1 - clamp01(p.value)) * 100
          const labelBelow = y < 35
          return (
            <div
              key={`${p.time}-${i}`}
              className="absolute"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div
                onPointerDown={onDotPointerDown(i)}
                onPointerMove={onDotPointerMove}
                onPointerUp={onDotPointerUp}
                onPointerCancel={onDotPointerUp}
                onContextMenu={onRemove(i)}
                onDoubleClick={onResetPoint(i)}
                className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full bg-violet-300 ring-2 ring-violet-300/25 hover:bg-white active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                title={`Expression ${Math.round(p.value * 100)}% at ${p.time.toFixed(2)}s`}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded bg-neutral-950/80 px-1 font-mono text-[9px] text-violet-200"
                style={{ top: labelBelow ? 7 : -16 }}
              >
                {Math.round(p.value * 100)}%
              </div>
            </div>
          )
        })}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-violet-100/70 shadow-[0_0_4px_rgba(221,214,254,0.5)]"
          style={{ left: `${playheadPct}%` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1.5 top-0.5 font-mono text-[9px] text-neutral-500"
        >
          pp → ff
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute right-1.5 top-0.5 font-mono text-[9px] text-violet-200/80"
        >
          {Math.round(currentExpression * 100)}%
        </div>
        {points.length === 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-neutral-500"
          >
            100% — click to add expression
          </div>
        )}
      </div>
    </div>
  )
}
