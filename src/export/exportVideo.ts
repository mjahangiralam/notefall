import type { ParsedSong } from '../midi/types'
import type { Settings } from '../store'
import {
  VideoRenderAborted,
  isVideoExportSupported,
  renderSongVideo,
  type AudioTrackConfig,
  type VideoRenderOptions,
  type VideoRenderProgress,
} from './renderVideo'

// ──────────────────────────────────────────────────────────────────────
// Composable export settings — the export-settings dialog picks a value
// from each axis (resolution, fps, quality) and the bitrate ladder
// looks up the right number. Splitting "preset" into independent axes
// instead of a flat `1080p · 60fps · High` list keeps the UI readable
// when we add more dimensions (e.g. shorter aspect ratios for vertical
// video) and lets each axis evolve independently.
// ──────────────────────────────────────────────────────────────────────

export type VideoResolutionId = '720p' | '1080p' | '4k'
export type VideoFps = 30 | 60
export type VideoQualityId = 'standard' | 'high'

export const VIDEO_RESOLUTIONS: Record<
  VideoResolutionId,
  { width: number; height: number; label: string }
> = {
  '720p': { width: 1280, height: 720, label: '720p' },
  '1080p': { width: 1920, height: 1080, label: '1080p' },
  '4k': { width: 3840, height: 2160, label: '4K' },
}

export const VIDEO_QUALITIES: Record<
  VideoQualityId,
  { label: string; bitrateMul: number }
> = {
  standard: { label: 'Standard', bitrateMul: 1.0 },
  high: { label: 'High', bitrateMul: 1.5 },
}

const BASE_VIDEO_BITRATES_KBPS: Record<`${VideoResolutionId}_${VideoFps}`, number> = {
  '720p_30': 4_000,
  '720p_60': 6_000,
  '1080p_30': 8_000,
  '1080p_60': 12_000,
  '4k_30': 25_000,
  '4k_60': 40_000,
}

export function computeVideoBitrateKbps(
  resolution: VideoResolutionId,
  fps: VideoFps,
  quality: VideoQualityId,
): number {
  const base = BASE_VIDEO_BITRATES_KBPS[`${resolution}_${fps}`]
  return Math.round(base * VIDEO_QUALITIES[quality].bitrateMul)
}

export const DEFAULT_AUDIO_CONFIG: AudioTrackConfig = {
  sampleRate: 44_100,
  bitrateKbps: 192,
}

export type VideoExportResult =
  | { kind: 'ok' }
  | { kind: 'cancelled' }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string }

export type Mp4ExportOptions = {
  width: number
  height: number
  fps: number
  videoBitrateKbps: number
  /** `null` to produce a silent MP4 (no audio track). */
  audio: AudioTrackConfig
  /** Optional accompaniment buffer mixed into the audio track. */
  userAudio?: {
    buffer: AudioBuffer
    offsetSec: number
    volume: number
    trimStartSec: number
    trimEndSec: number | null
  } | null
  fileName?: string
  signal?: AbortSignal
  onProgress?: (p: VideoRenderProgress) => void
}

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
  }) => Promise<FileSystemFileHandle>
}

/**
 * Chromium's File System Access API lets the muxer stream the MP4 directly
 * to disk. `undefined` means the API is unavailable and the caller should
 * use the legacy in-memory download path. `null` means the user cancelled.
 */
async function pickMp4OutputStream(
  fileName: string,
): Promise<FileSystemWritableFileStream | null | undefined> {
  if (typeof window === 'undefined') return undefined
  const picker = (window as SavePickerWindow).showSaveFilePicker
  if (typeof picker !== 'function') return undefined

  try {
    const handle = await picker.call(window, {
      suggestedName: fileName,
      types: [
        {
          description: 'MP4 video',
          accept: { 'video/mp4': ['.mp4'] },
        },
      ],
    })
    return await handle.createWritable()
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return null
    throw e
  }
}

export async function exportSongToMp4(
  song: ParsedSong,
  settings: Settings,
  options: Mp4ExportOptions,
): Promise<VideoExportResult> {
  if (!isVideoExportSupported()) return { kind: 'unsupported' }

  const fileName = options.fileName ?? defaultMp4FileName(song.name)

  try {
    // Ask for the destination before rendering while this function is still
    // running inside the Export button's user gesture. On Chrome/Edge this
    // enables true streaming and avoids the giant final ArrayBuffer.
    const outputStream = await pickMp4OutputStream(fileName)
    if (outputStream === null) return { kind: 'cancelled' }

    const renderOptions: VideoRenderOptions = {
      width: options.width,
      height: options.height,
      fps: options.fps,
      videoBitrateKbps: options.videoBitrateKbps,
      audio: options.audio,
      outputStream: outputStream ?? null,
      userAudio: options.userAudio ?? null,
      signal: options.signal,
      onProgress: options.onProgress,
    }

    const blob = await renderSongVideo(song, settings, renderOptions)
    if (options.signal?.aborted) return { kind: 'cancelled' }

    // Direct-to-disk path is already complete once renderSongVideo returns.
    if (outputStream) return { kind: 'ok' }

    // Safari/Firefox fallback: keep the existing Blob download behavior.
    if (!blob) throw new Error('Video export produced no output.')
    triggerDownload(blob, fileName)
    return { kind: 'ok' }
  } catch (e) {
    if (e instanceof VideoRenderAborted) return { kind: 'cancelled' }
    const message = e instanceof Error ? e.message : String(e)
    return { kind: 'error', message }
  }
}

function defaultMp4FileName(songName: string): string {
  const base = songName.trim().replace(/\.(mid|midi)$/i, '')
  const cleaned = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim()
  const fallback = `notefall-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`
  return `${cleaned || fallback}.mp4`
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
