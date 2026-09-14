import { useEffect } from 'react'
import { useStore } from '../store'
import { audioEngine } from './engine'

/** Keep the realtime rack aligned with persisted per-track instrument choices. */
export function TrackInstrumentSync() {
  const song = useStore((state) => state.song)
  const trackInstruments = useStore((state) => state.settings.trackInstruments)

  useEffect(() => {
    if (!song) return
    void audioEngine.setTrackInstruments(trackInstruments).catch((error) => {
      console.error('Could not prepare selected MIDI instruments', error)
    })
  }, [song, trackInstruments])

  return null
}
