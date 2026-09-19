import { useStore, type VisualizationMode } from '../store'

const MODES: { id: VisualizationMode; label: string }[] = [
  { id: 'piano', label: 'Piano' },
  { id: 'sheet', label: 'Sheet Music' },
  { id: 'space3d', label: '3D Space' },
]

/** Screen-only selector. The WebGL scene, not this HTML, is recorded in MP4. */
export function VisualizationModePicker() {
  const mode = useStore((s) => s.settings.visualizationMode)
  const updateSettings = useStore((s) => s.updateSettings)
  return (
    <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-xl border border-white/20 bg-neutral-950/85 p-1 shadow-lg backdrop-blur-md" role="group" aria-label="Visualization mode">
      {MODES.map(({ id, label }) => (
        <button
          type="button"
          key={id}
          aria-pressed={mode === id}
          onClick={() => updateSettings({ visualizationMode: id })}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-300 ${mode === id ? 'bg-sky-500 text-white' : 'text-neutral-200 hover:bg-white/15'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
