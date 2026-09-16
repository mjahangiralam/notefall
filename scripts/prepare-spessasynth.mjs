import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_RELATIVE = 'node_modules/spessasynth_lib/dist/spessasynth_processor.min.js'
const DEST_RELATIVE = 'public/spessasynth_processor.min.js'

const source = resolve(REPO_ROOT, SOURCE_RELATIVE)
const destination = resolve(REPO_ROOT, DEST_RELATIVE)

await mkdir(dirname(destination), { recursive: true })
await copyFile(source, destination)
console.log(`Prepared SpessaSynth worklet: ${DEST_RELATIVE}`)
