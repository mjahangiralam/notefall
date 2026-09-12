import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from 'react-aria-components'
import { useStore } from '../store'
import { analyzeSong } from '../musicAnalysis/analyzeSong'
import { generateSmartAutomation } from '../musicAnalysis/smartAutomation'
import { generateSmartDynamics } from '../musicAnalysis/smartDynamics'
import { generateSmartSpeed } from '../musicAnalysis/smartSpeed'
import { generateSmartPins } from '../musicAnalysis/smartPins'

type SmartAction = 'all' | 'pins' | 'dynamics' | 'speed'

function applySettingsAutomation(patch: {
  midiSpeedAutomation?: ReturnType<typeof generateSmartSpeed>
  settingsKeyframes?: ReturnType<typeof generateSmartPins>
}) {
  const store = useStore.getState()
  store.beginSettingsEdit()
  try {
    // Generated pins should replace the automation layer, not whichever pin
    // happens to be the Inspector's current edit target.
    useStore.setState({ editingKeyframeTime: null })
    useStore.getState().updateSettings(patch)
  } finally {
    useStore.getState().endSettingsEdit()
  }
}

function runSmart(action: SmartAction) {
  const state = useStore.getState()
  const song = state.song
  if (!song) return

  if (action === 'all') {
    // Smart All is deliberately coordinated by one pure function so all three
    // layers share the same structural interpretation of the song.
    const result = generateSmartAutomation(song, state.settings)
    state.applySongEdit((prev) => ({
      ...prev,
      expressions: result.expressions,
    }))
    applySettingsAutomation({
      midiSpeedAutomation: result.speed,
      settingsKeyframes: result.pins,
    })
    return
  }

  const analysis = analyzeSong(song)
  if (action === 'dynamics') {
    const expressions = generateSmartDynamics(song, analysis)
    state.applySongEdit((prev) => ({ ...prev, expressions }))
    return
  }

  if (action === 'speed') {
    const speed = generateSmartSpeed(
      song,
      analysis,
      state.settings.midiSpeedAutomation,
    )
    applySettingsAutomation({ midiSpeedAutomation: speed })
    return
  }

  const pins = generateSmartPins(
    analysis,
    state.settings,
    state.settings.midiSpeedAutomation,
  )
  applySettingsAutomation({ settingsKeyframes: pins })
}

const itemClass =
  'flex cursor-default flex-col rounded px-2.5 py-2 outline-none data-[focused]:bg-neutral-800'

export function SmartAutomationMenu() {
  const song = useStore((s) => s.song)

  return (
    <MenuTrigger>
      <Button
        isDisabled={!song}
        aria-label="Smart music automation"
        className="flex h-6 items-center gap-1 rounded bg-violet-500/15 px-2 text-[10px] font-semibold text-violet-200 outline-none ring-1 ring-violet-400/20 transition-colors hover:bg-violet-500/25 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-35 data-[focus-visible]:ring-2 data-[focus-visible]:ring-violet-300/60"
      >
        <span aria-hidden>✦</span>
        <span>Smart</span>
        <span className="text-violet-300/70" aria-hidden>▾</span>
      </Button>
      <Popover
        placement="top end"
        className="z-50 rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-xl outline-none data-[entering]:animate-in data-[entering]:fade-in data-[entering]:duration-150"
      >
        <Menu
          aria-label="Smart automation actions"
          className="flex w-56 flex-col gap-0.5 outline-none"
        >
          <MenuItem
            onAction={() => runSmart('all')}
            textValue="Smart All"
            className={itemClass}
          >
            <span className="text-xs font-semibold text-violet-100">Smart All</span>
            <span className="text-[10px] text-neutral-500">Pins + dynamics + expressive speed</span>
          </MenuItem>
          <MenuItem
            onAction={() => runSmart('pins')}
            textValue="Smart Pins"
            className={itemClass}
          >
            <span className="text-xs text-neutral-200">Smart Pins</span>
            <span className="text-[10px] text-neutral-500">Place musical visual keyframes</span>
          </MenuItem>
          <MenuItem
            onAction={() => runSmart('dynamics')}
            textValue="Smart Dynamics"
            className={itemClass}
          >
            <span className="text-xs text-neutral-200">Smart Dynamics</span>
            <span className="text-[10px] text-neutral-500">Shape the CC11 expression curve</span>
          </MenuItem>
          <MenuItem
            onAction={() => runSmart('speed')}
            textValue="Smart Speed"
            className={itemClass}
          >
            <span className="text-xs text-neutral-200">Smart Speed</span>
            <span className="text-[10px] text-neutral-500">Add restrained phrase rubato</span>
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}
