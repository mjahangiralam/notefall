import { readFile, writeFile } from 'node:fs/promises'

async function patchFile(path, patches) {
  let source = await readFile(path, 'utf8')
  let changed = false
  for (const [before, after] of patches) {
    if (source.includes(after)) continue
    if (!source.includes(before)) {
      throw new Error(`Expected migration pattern not found in ${path}:\n${before}`)
    }
    source = source.replace(before, after)
    changed = true
  }
  if (changed) await writeFile(path, source)
}

await patchFile('src/audio/instrumentCatalog.ts', [
  [
    "  | 'drum:gm-sf2'\n  | 'drum:TR-808'",
    "  | 'drum:gm-sf2'\n  | 'drum:gm-sf2-orchestral'\n  | 'drum:TR-808'",
  ],
  [
    "      override === 'drum:gm-sf2' ||\n      override === 'drum:TR-808' ||",
    "      override === 'drum:gm-sf2' ||\n      override === 'drum:gm-sf2-orchestral' ||\n      override === 'drum:TR-808' ||",
  ],
  [
    "  if (track.percussion || track.channel === 9) return 'drum:gm-sf2'",
    "  if (track.percussion || track.channel === 9) {\n    const percussionName = `${track.name ?? ''} ${track.instrumentName ?? ''}`\n    if (/orchestr/i.test(percussionName)) return 'drum:gm-sf2-orchestral'\n    return 'drum:gm-sf2'\n  }",
  ],
])

await patchFile('src/audio/instrumentRack.ts', [
  [
    "  createGeneralUserDrumBackend,\n  type Sf2DrumBackend,",
    "  createGeneralUserDrumBackend,\n  type Sf2DrumBackend,\n  type Sf2DrumKit,",
  ],
  [
    "  stopAll(): void\n  setVolume(value: number): void",
    "  stopAll(): void\n  finalizeOffline(durationSeconds: number): Promise<void>\n  setVolume(value: number): void",
  ],
  [
    "  function startTr808(\n    midi: number,\n    velocity: number,\n    atAudioTime?: number,\n    stopId?: string,\n  ): StopFn {\n    const drum = drums\n    if (!drum) return () => {}\n    return drum.start({\n      note: drumNameForMidi(midi),\n      velocity: Math.max(1, Math.min(127, Math.round(velocity * 127))),\n      time: atAudioTime,\n      stopId,\n    })\n  }",
    "  function startTr808(\n    midi: number,\n    velocity: number,\n    atAudioTime?: number,\n    stopId?: string,\n  ): StopFn {\n    const drum = drums\n    if (!drum) return () => {}\n    return drum.start({\n      note: drumNameForMidi(midi),\n      velocity: Math.max(1, Math.min(127, Math.round(velocity * 127))),\n      time: atAudioTime,\n      stopId,\n    })\n  }\n\n  function startSf2Kit(\n    kit: Sf2DrumKit,\n    midi: number,\n    velocity: number,\n    atAudioTime?: number,\n    stopId?: string,\n  ): StopFn {\n    if (sf2Drums) {\n      try {\n        return sf2Drums.start(midi, velocity, atAudioTime, stopId, kit)\n      } catch (error) {\n        if (!sf2StartFailureLogged) {\n          sf2StartFailureLogged = true\n          console.warn('GeneralUser GS drum playback failed; using TR-808 fallback.', error)\n        }\n      }\n    }\n    return startTr808(midi, velocity, atAudioTime, stopId)\n  }",
  ],
  [
    "        if (id === 'drum:gm-sf2') {\n          await ensureSf2Drums(onProgress)\n          return\n        }",
    "        if (id === 'drum:gm-sf2' || id === 'drum:gm-sf2-orchestral') {\n          await ensureSf2Drums(onProgress)\n          return\n        }",
  ],
  [
    "      if (route === 'drum:gm-sf2') {\n        if (sf2Drums) {\n          try {\n            return sf2Drums.start(midi, velocity, atAudioTime, stopId)\n          } catch (error) {\n            if (!sf2StartFailureLogged) {\n              sf2StartFailureLogged = true\n              console.warn('GeneralUser GS drum playback failed; using TR-808 fallback.', error)\n            }\n          }\n        }\n        return startTr808(midi, velocity, atAudioTime, stopId)\n      }",
    "      if (route === 'drum:gm-sf2') {\n        return startSf2Kit('power', midi, velocity, atAudioTime, stopId)\n      }\n\n      if (route === 'drum:gm-sf2-orchestral') {\n        return startSf2Kit('orchestral', midi, velocity, atAudioTime, stopId)\n      }",
  ],
  [
    "    stopAll() {\n      grand?.stopAll()\n      for (const instrument of soundfonts.values()) instrument.stop()\n      sf2Drums?.stop()\n      drums?.stop()\n    },\n    setVolume(value) {",
    "    stopAll() {\n      grand?.stopAll()\n      for (const instrument of soundfonts.values()) instrument.stop()\n      sf2Drums?.stop()\n      drums?.stop()\n    },\n    async finalizeOffline(durationSeconds) {\n      await sf2Drums?.finalizeOffline?.(durationSeconds)\n    },\n    setVolume(value) {",
  ],
])

await patchFile('src/export/renderAudio.ts', [
  [
    "  if (signal?.aborted) {\n    piano?.dispose()\n    throw new AudioRenderAborted()\n  }\n\n  // Poll `ctx.currentTime`",
    "  if (piano) {\n    await raceWithAbort(piano.finalizeOffline(totalDuration), signal)\n  }\n\n  if (signal?.aborted) {\n    piano?.dispose()\n    throw new AudioRenderAborted()\n  }\n\n  // Poll `ctx.currentTime`",
  ],
])

console.log('Applied SpessaSynth routing migration.')
