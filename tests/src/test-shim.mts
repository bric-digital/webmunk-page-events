/**
 * Test shim for rex-page-events.
 *
 * Registers a capture module alongside the service-worker module so Playwright
 * tests can assert on dispatched events, and imports the browser-side module
 * so page events (pageshow/pagehide/focus/blur) are exercised too.
 *
 * Load tests/src/build/test-shim.bundle.js AFTER the chrome mock on window.
 */
import rexCorePlugin, {
  registerREXModule,
  REXServiceWorkerModule,
} from '@bric/rex-core/service-worker'
import * as rexLists from '@bric/rex-lists'
import pageEventsServiceWorker from '../../src/service-worker.mts'
import pageEventsBrowser from '../../src/browser.mts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any

g.__capturedEvents = []

class EventCaptureModule extends REXServiceWorkerModule {
  moduleName(): string {
    return 'EventCapture'
  }
  override setup(): void {
    /* intentional no-op */
  }
  override handleMessage(
    _msg: unknown,
    _sender: unknown,
    _sendResponse: (r: unknown) => void
  ): boolean {
    return false
  }
  override logEvent(event: object): void {
    const arr = g.__capturedEvents
    if (Array.isArray(arr)) {
      arr.push(event)
    }
  }
}

registerREXModule(new EventCaptureModule())

g.__pageEventsServiceWorker = pageEventsServiceWorker
g.__pageEventsBrowser = pageEventsBrowser

g.__sendMessage = (message: Record<string, unknown>, sender?: unknown): Promise<unknown> => {
  return new Promise((resolve) => {
    // Route through rex-core and directly through the module so content-script
    // messages get the real sender object the SW module uses for tab_id lookup.
    const delivered = pageEventsServiceWorker.handleMessage(
      message as { messageType?: string },
      (sender as chrome.runtime.MessageSender) ?? {},
      resolve
    )
    if (!delivered) {
      rexCorePlugin.handleMessage(message, sender ?? {}, resolve)
    }
  })
}

g.__resetCapturedEvents = () => {
  g.__capturedEvents = []
}

g.__refreshConfig = () => {
  g.__pageEventsServiceWorker.refreshConfiguration()
}

g.__rexLists = {
  createListEntry: rexLists.createListEntry,
  bulkCreateListEntries: rexLists.bulkCreateListEntries,
  resetListDatabase: rexLists.resetListDatabase,
  matchDomainAgainstList: rexLists.matchDomainAgainstList,
}

// Expose the url-active subscriber seam for specs. We go through the globalThis
// contract (not the direct export) so specs prove the integration path that
// rex-history will actually use.
g.__urlActiveGlobal = () => g.__rexPageEventsUrlActive
g.__subscribeUrlActive = (listener: (event: unknown) => void): (() => void) => {
  const seam = g.__rexPageEventsUrlActive
  if (!seam || typeof seam.subscribe !== 'function') {
    throw new Error('__rexPageEventsUrlActive.subscribe not installed')
  }
  return seam.subscribe(listener)
}

g.__pageEventsShimLoaded = true
