import { Button } from 'react-aria-components'
import { useStore } from '../store'
import {
  buildMoonlitReveriePreset,
  looksLikeMoonlitReveriePreset,
} from '../presets/moonlitReverie'

/**
 * Applies the Moonlit Reverie visual director + piano profile as one
 * undoable settings edit. The control intentionally lives over the
 * viewport instead of in the global defaults: other songs/projects are
 * unchanged unless the user explicitly presses it.
 */
export function MoonlitReveriePresetButton() {
  const song = useStore((s) => s.song)
  const applied = useStore((s) => looksLikeMoonlitReveriePreset(s.settings))

  const applyPreset = () => {
    if (!song) return

    const store = useStore.getState()
    store.beginSettingsEdit()
    try {
      // PinTargetSync normally follows the playhead. Clear the edit target
      // for this synchronous transaction so animatable base values do not
      // accidentally write into whichever existing pin is under the head.
      useStore.setState({ editingKeyframeTime: null })
      useStore.getState().updateSettings(buildMoonlitReveriePreset(song.duration))
    } finally {
      useStore.getState().endSettingsEdit()
    }
  }

  return (
    <Button
      type="button"
      isDisabled={!song}
      onPress={applyPreset}
      title="Apply Moonlit Reverie cinematic visuals and piano profile"
      className="absolute right-3 top-3 z-20 rounded-md border border-sky-300/25 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-sky-100 shadow-lg backdrop-blur-md outline-none transition hover:border-sky-200/45 hover:bg-slate-900/80 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-35 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-300/60"
    >
      {applied ? 'Moonlit applied' : 'Moonlit Reverie'}
    </Button>
  )
}
