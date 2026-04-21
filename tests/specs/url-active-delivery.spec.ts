import { test, expect, Page } from '@playwright/test'

async function bootstrap(page: Page, pageEventsConfig: Record<string, unknown>) {
  await page.goto('/test-page.html')
  await page.waitForFunction(() => (window as any).__pageEventsShimLoaded === true)
  await page.evaluate((cfg) => {
    // Install a url-active listener BEFORE config loads so we don't miss the tab_open burst.
    ;(window as any).__urlActiveRecords = []
    ;(window as any).__urlActiveUnsubscribe = (window as any).__subscribeUrlActive((record: unknown) => {
      ;(window as any).__urlActiveRecords.push(record)
    })
    ;(window as any).__seedConfig(cfg)
    ;(window as any).__refreshConfig()
  }, pageEventsConfig)
  await page.waitForFunction(() =>
    (window as any).__pageEventsServiceWorker?.config !== null
  )
  await page.evaluate(() => {
    ;(window as any).__resetCapturedEvents()
    ;(window as any).__urlActiveRecords = []
  })
}

async function capturedEvents(page: Page): Promise<any[]> {
  return page.evaluate(() => (window as any).__capturedEvents)
}

async function urlActiveRecords(page: Page): Promise<any[]> {
  return page.evaluate(() => (window as any).__urlActiveRecords)
}

test.describe('rex-page-url-active delivery seam', () => {
  test('globalThis.__rexPageEventsUrlActive is installed on module load', async ({ page }) => {
    await page.goto('/test-page.html')
    await page.waitForFunction(() => (window as any).__pageEventsShimLoaded === true)

    const seamShape = await page.evaluate(() => {
      const seam = (window as any).__urlActiveGlobal()
      return {
        exists: !!seam,
        hasSubscribe: typeof seam?.subscribe === 'function',
      }
    })
    expect(seamShape.exists).toBe(true)
    expect(seamShape.hasSubscribe).toBe(true)
  })

  test('subscriber receives a record for tab_open', async ({ page }) => {
    await bootstrap(page, { enabled: true })
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 50, windowId: 1, url: 'https://sub.test/', title: 'T', active: true })
    })

    await page.waitForFunction(() => (window as any).__urlActiveRecords.length >= 1)
    const records = await urlActiveRecords(page)
    expect(records.length).toBe(1)
    expect(records[0].name).toBe('rex-page-url-active')
    expect(records[0].url).toBe('https://sub.test/')
    expect(records[0].tab_id).toBe(50)
    expect(records[0].window_id).toBe(1)
    expect(typeof records[0].session_id).toBe('string')
    expect(typeof records[0].url_shown_at).toBe('number')
  })

  test('subscriber receives a SECOND record on tab_url_change (raw URL)', async ({ page }) => {
    await bootstrap(page, { enabled: true })
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 51, windowId: 1, url: 'https://a.test/', title: 'A', active: true })
    })
    await page.waitForFunction(() => (window as any).__urlActiveRecords.length >= 1)
    await page.evaluate(() => {
      ;(window as any).__fireTabUpdated(51, { url: 'https://b.test/' }, { id: 51, windowId: 1, url: 'https://b.test/', title: 'B' })
    })
    await page.waitForFunction(() => (window as any).__urlActiveRecords.length >= 2)

    const records = await urlActiveRecords(page)
    expect(records[0].url).toBe('https://a.test/')
    expect(records[1].url).toBe('https://b.test/')
    // Both share the same session_id because it's the same tab.
    expect(records[0].session_id).toBe(records[1].session_id)
    // Second record's url_shown_at is later.
    expect(records[1].url_shown_at).toBeGreaterThan(records[0].url_shown_at)
  })

  test('default (debug:false): rex-page-url-active does NOT hit the event bus', async ({ page }) => {
    await bootstrap(page, { enabled: true })
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 52, windowId: 1, url: 'https://c.test/', title: 'C', active: true })
    })
    await page.waitForFunction(() => (window as any).__urlActiveRecords.length >= 1)

    const busEvents = await capturedEvents(page)
    const urlActiveOnBus = busEvents.filter((e) => e.name === 'rex-page-url-active')
    expect(urlActiveOnBus.length).toBe(0)
  })

  test('debug:true: rex-page-url-active ALSO appears on the event bus', async ({ page }) => {
    await bootstrap(page, { enabled: true, debug: true })
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 53, windowId: 1, url: 'https://d.test/', title: 'D', active: true })
    })
    await page.waitForFunction(() => (window as any).__urlActiveRecords.length >= 1)

    const busEvents = await capturedEvents(page)
    const urlActiveOnBus = busEvents.filter((e) => e.name === 'rex-page-url-active')
    expect(urlActiveOnBus.length).toBe(1)
    expect(urlActiveOnBus[0].url).toBe('https://d.test/')
    // Subscriber still got it too — debug adds the bus, doesn't replace the seam.
    expect((await urlActiveRecords(page)).length).toBe(1)
  })

  test('URL fragment match is exact: #x and #y produce distinct records', async ({ page }) => {
    await bootstrap(page, { enabled: true })
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 54, windowId: 1, url: 'https://frag.test/#x', title: 'F', active: true })
    })
    await page.waitForFunction(() => (window as any).__urlActiveRecords.length >= 1)
    await page.evaluate(() => {
      ;(window as any).__fireTabUpdated(54, { url: 'https://frag.test/#y' }, { id: 54, windowId: 1, url: 'https://frag.test/#y', title: 'F' })
    })
    await page.waitForFunction(() => (window as any).__urlActiveRecords.length >= 2)

    const records = await urlActiveRecords(page)
    expect(records[0].url).toBe('https://frag.test/#x')
    expect(records[1].url).toBe('https://frag.test/#y')
    expect(records[0].url).not.toBe(records[1].url)
  })

  test('unsubscribe stops further deliveries', async ({ page }) => {
    await bootstrap(page, { enabled: true })
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 55, windowId: 1, url: 'https://e.test/', title: 'E', active: true })
    })
    await page.waitForFunction(() => (window as any).__urlActiveRecords.length >= 1)

    await page.evaluate(() => {
      ;(window as any).__urlActiveUnsubscribe()
      ;(window as any).__fireTabUpdated(55, { url: 'https://e2.test/' }, { id: 55, windowId: 1, url: 'https://e2.test/', title: 'E2' })
    })

    // Give the handler a beat.
    await page.waitForTimeout(50)
    const records = await urlActiveRecords(page)
    expect(records.length).toBe(1) // still just the first
  })

  test('redaction: subscriber receives RAW url even when the emitted event is redacted', async ({ page }) => {
    await bootstrap(page, { enabled: true, filter_lists: ['sensitive'] })
    // Seed rex-lists with an entry that will match our URL.
    await page.evaluate(() =>
      (window as any).__rexLists.createListEntry({
        list_name: 'sensitive',
        pattern: 'raw.test',
        pattern_type: 'domain',
        source: 'backend',
        metadata: { category: 'health' },
      })
    )
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 56, windowId: 1, url: 'https://raw.test/private', title: 'secret', active: true })
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_open')
    )
    await page.waitForFunction(() => (window as any).__urlActiveRecords.length >= 1)

    const busEvent = (await capturedEvents(page)).find((e) => e.event_type === 'tab_open')
    const subRecord = (await urlActiveRecords(page))[0]

    // Event bus sees the redacted URL.
    expect(busEvent.url).toBe('CATEGORY:health')
    expect(busEvent.filtered).toBe(true)
    // Subscriber sees the RAW URL — that's the whole point of the seam.
    expect(subRecord.url).toBe('https://raw.test/private')
  })
})
