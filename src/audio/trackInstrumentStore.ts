import { create } from 'zustand'

export type TrackInstrumentAssignments = Record<string, string>

type TrackInstrumentState = {
  assignments: TrackInstrumentAssignments
  setTrackInstrument: (track: number, instrument: string) => void
  clearTrackInstrument: (track: number) => void
  resetTrackInstruments: () => void
}

/**
 * Session-level per-track audio overrides.
 *
 * Missing keys mean Auto (use the MIDI program). Keeping this in a focused
 * store avoids coupling visual Settings keyframe automation to audio-only
 * instrument choices. The export renderer reads the same snapshot so preview
 * and export use identical assignments.
 */
export const useTrackInstrumentStore = create<TrackInstrumentState>((set) => ({
  assignments: {},
  setTrackInstrument: (track, instrument) =>
    set((state) => {
      const key = String(track)
      if (instrument === 'auto') {
        const next = { ...state.assignments }
        delete next[key]
        return { assignments: next }
      }
      return {
        assignments: { ...state.assignments, [key]: instrument },
      }
    }),
  clearTrackInstrument: (track) =>
    set((state) => {
      const next = { ...state.assignments }
      delete next[String(track)]
      return { assignments: next }
    }),
  resetTrackInstruments: () => set({ assignments: {} }),
}))

export function getTrackInstrumentAssignments(): TrackInstrumentAssignments {
  return useTrackInstrumentStore.getState().assignments
}
