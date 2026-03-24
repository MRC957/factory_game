/**
 * Loads client scripts into the current jsdom window via one combined eval().
 *
 * window.eval() (jsdom's custom eval) runs code in the jsdom global scope,
 * making every top-level `function` declaration available as window.<name>.
 * `let`/`const` variables stay in the eval closure but remain reachable by
 * those functions, so the full module works correctly.
 *
 * IMPORTANT: call createDOM() and stub fetch BEFORE calling loadGame().
 * The script has a module-level event listener on #hours-input and an IIFE
 * that calls fetch("/api/state") — both must find their dependencies ready.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join }  from 'node:path'

const __dir  = dirname(fileURLToPath(import.meta.url))
const CLIENT_JS = [
  join(__dir, '../../../src/game_factory/static/js/state.js'),
  join(__dir, '../../../src/game_factory/static/js/utils.js'),
  join(__dir, '../../../src/game_factory/static/js/render.js'),
  join(__dir, '../../../src/game_factory/static/js/actions.js'),
  join(__dir, '../../../src/game_factory/static/js/boot.js'),
]

let loaded = false

export async function loadGame(mockState) {
  // Reset the loaded flag so each test file gets a fresh script evaluation.
  loaded = false

  const code = CLIENT_JS.map(path => readFileSync(path, 'utf-8')).join('\n\n')
  // window.eval executes in the jsdom window's global scope.
  window.eval(code)
  loaded = true

  // Flush the micro-task queue so the boot IIFE's await completes before
  // tests start querying the DOM.
  await flushPromises()
}

/** Drain the micro-task queue (pending Promises). */
export async function flushPromises() {
  await new Promise(resolve => setTimeout(resolve, 0))
}
