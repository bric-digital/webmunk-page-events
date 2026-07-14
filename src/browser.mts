import { REXClientModule, registerREXModule } from '@bric/rex-core/browser'

type BrowserEventType = 'page_show' | 'page_hide' | 'tab_focus' | 'tab_blur'

interface PageEventMessage {
  messageType: 'pageEvent'
  event_type: BrowserEventType
  url: string
  title: string
  timestamp: number
  persisted?: boolean
}

class REXPageEventsModule extends REXClientModule {
  toString(): string {
    return 'REXPageEventsModule'
  }

  setup() {
    console.log('[rex-page-events] browser setup')

    window.addEventListener('pageshow', (event: PageTransitionEvent) => {
      this.send({
        messageType: 'pageEvent',
        event_type: 'page_show',
        url: location.href,
        title: document.title,
        timestamp: Date.now(),
        persisted: event.persisted,
      })
    })

    window.addEventListener('pagehide', (event: PageTransitionEvent) => {
      this.send({
        messageType: 'pageEvent',
        event_type: 'page_hide',
        url: location.href,
        title: document.title,
        timestamp: Date.now(),
        persisted: event.persisted,
      })
    })

    window.addEventListener('focus', () => {
      this.send({
        messageType: 'pageEvent',
        event_type: 'tab_focus',
        url: location.href,
        title: document.title,
        timestamp: Date.now(),
      })
    })

    window.addEventListener('blur', () => {
      this.send({
        messageType: 'pageEvent',
        event_type: 'tab_blur',
        url: location.href,
        title: document.title,
        timestamp: Date.now(),
      })
    })
  }

  private send(message: PageEventMessage): void {
    try {
      const result = chrome.runtime.sendMessage(message)
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        ;(result as Promise<unknown>).catch((err: unknown) => {
          console.debug('[rex-page-events] sendMessage failed', err)
        })
      }
    } catch (err) {
      console.debug('[rex-page-events] sendMessage threw', err)
    }
  }
}

const plugin = new REXPageEventsModule()

registerREXModule(plugin)

export default plugin
