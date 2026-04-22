import { test, expect, Page } from '@playwright/test'

async function bootstrap(page: Page) {
  await page.goto('/test-page.html')
  await page.waitForFunction(() => (window as any).__pageEventsShimLoaded === true)
  await page.evaluate(() => {
    ;(window as any).__seedConfig({ enabled: true })
    ;(window as any).__refreshConfig()
  })
  await page.waitForFunction(() =>
    (window as any).__pageEventsServiceWorker?.config !== null
  )
  await page.evaluate(() => (window as any).__resetCapturedEvents())
}

async function capturedEvents(page: Page): Promise<any[]> {
  return page.evaluate(() => (window as any).__capturedEvents)
}

test.describe('Service-worker tab/window lifecycle', () => {
  test('tab_open assigns a session_id and emits tab_open event', async ({ page }) => {
    await bootstrap(page)

    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({
        id: 42,
        windowId: 1,
        url: 'https://example.test/a',
        title: 'A',
        active: true,
      })
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_open')
    )
    const events = await capturedEvents(page)
    const tabOpen = events.find((e) => e.event_type === 'tab_open')
    expect(tabOpen.tab_id).toBe(42)
    expect(tabOpen.window_id).toBe(1)
    expect(tabOpen.url).toBe('https://example.test/a')
    expect(tabOpen.session_id).toMatch(/^[0-9a-f-]+$/i)
  })

  test('tab_url_change flushes the OUTGOING segment with url_focus_duration_ms and url_dwell_ms', async ({ page }) => {
    await bootstrap(page)
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 42, windowId: 1, url: 'https://example.test/a', title: 'A', active: true })
    })
    // Let wall-clock + focus accrue on URL "a" so the flush has non-zero numbers.
    await page.waitForTimeout(60)
    await page.evaluate(() => {
      ;(window as any).__resetCapturedEvents()
      ;(window as any).__fireTabUpdated(42, { url: 'https://example.test/b' }, { id: 42, windowId: 1, url: 'https://example.test/b', title: 'B' })
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_url_change')
    )
    const urlChange = (await capturedEvents(page)).find((e) => e.event_type === 'tab_url_change')
    // The tab_url_change event describes the OUTGOING URL so it can be linked back
    // to a specific rex-history visit.
    expect(urlChange.url).toBe('https://example.test/a')
    expect(urlChange.url_focus_duration_ms).toBeGreaterThan(0)
    expect(urlChange.url_dwell_ms).toBeGreaterThan(0)
    // Dwell (wall-clock) must be >= focus time (only-when-focused).
    expect(urlChange.url_dwell_ms).toBeGreaterThanOrEqual(urlChange.url_focus_duration_ms)
  })

  test('after tab_url_change, subsequent events carry the NEW url and a fresher url_shown_at', async ({ page }) => {
    await bootstrap(page)
    const startTs = Date.now()
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 43, windowId: 1, url: 'https://example.test/a', title: 'A', active: true })
    })
    await page.waitForTimeout(60)
    await page.evaluate(() => {
      ;(window as any).__fireTabUpdated(43, { url: 'https://example.test/b' }, { id: 43, windowId: 1, url: 'https://example.test/b', title: 'B' })
    })
    // Now close — tab_close should describe the NEW URL, with a url_shown_at after the initial tab_open.
    await page.evaluate(() => {
      ;(window as any).__fireTabRemoved(43, { windowId: 1, isWindowClosing: false })
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_close')
    )
    const close = (await capturedEvents(page)).find((e) => e.event_type === 'tab_close')
    expect(close.url).toBe('https://example.test/b')
    // url_shown_at of the close event must be AFTER the navigation occurred.
    expect(close.url_shown_at).toBeGreaterThan(startTs + 50)
  })

  test('tab_close carries tab_lifetime_ms and focus_duration_ms', async ({ page }) => {
    await bootstrap(page)

    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 42, windowId: 1, url: 'https://example.test/a', title: 'A', active: true })
    })
    // Let wall-clock elapse so lifetime + focus are measurable.
    await page.waitForTimeout(50)
    await page.evaluate(() => {
      ;(window as any).__fireTabRemoved(42, { windowId: 1, isWindowClosing: false })
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_close')
    )
    const close = (await capturedEvents(page)).find((e) => e.event_type === 'tab_close')
    expect(close.tab_lifetime_ms).toBeGreaterThan(0)
    expect(close.focus_duration_ms).toBeGreaterThan(0)
    // Per-URL fields for the CURRENT (and only) URL segment.
    expect(close.url_focus_duration_ms).toBeGreaterThan(0)
    expect(close.url_dwell_ms).toBeGreaterThan(0)
    expect(close.is_window_closing).toBe(false)
  })

  test('onActivated switching tabs emits tab_blur for old, tab_focus for new', async ({ page }) => {
    await bootstrap(page)

    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 1, windowId: 1, url: 'https://a.test/', title: 'A', active: true })
      ;(window as any).__fireTabCreated({ id: 2, windowId: 1, url: 'https://b.test/', title: 'B', active: false })
      ;(window as any).__resetCapturedEvents()
      ;(window as any).__fireTabActivated({ tabId: 2, windowId: 1 })
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_focus')
    )
    const events = await capturedEvents(page)
    expect(events.some((e) => e.event_type === 'tab_blur' && e.tab_id === 1)).toBe(true)
    expect(events.some((e) => e.event_type === 'tab_focus' && e.tab_id === 2)).toBe(true)
  })

  test('tab_url_change carries previous_url on the second navigation, not the first', async ({ page }) => {
    await bootstrap(page)
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 50, windowId: 1, url: 'https://example.test/a', title: 'A', active: true })
    })
    // First navigation: a -> b. previous_url should be ABSENT (only one URL so far).
    await page.evaluate(() => {
      ;(window as any).__resetCapturedEvents()
      ;(window as any).__fireTabUpdated(50, { url: 'https://example.test/b' }, { id: 50, windowId: 1, url: 'https://example.test/b', title: 'B' })
    })
    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_url_change')
    )
    const firstChange = (await capturedEvents(page)).find((e) => e.event_type === 'tab_url_change')
    expect(firstChange.url).toBe('https://example.test/a')
    expect(firstChange.previous_url).toBeUndefined()
    expect(firstChange.previous_url_filtered).toBeUndefined()

    // Second navigation: b -> c. previous_url must now be 'a' (two hops back).
    await page.evaluate(() => {
      ;(window as any).__resetCapturedEvents()
      ;(window as any).__fireTabUpdated(50, { url: 'https://example.test/c' }, { id: 50, windowId: 1, url: 'https://example.test/c', title: 'C' })
    })
    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_url_change')
    )
    const secondChange = (await capturedEvents(page)).find((e) => e.event_type === 'tab_url_change')
    expect(secondChange.url).toBe('https://example.test/b')
    expect(secondChange.previous_url).toBe('https://example.test/a')
    expect(secondChange.previous_url_filtered).toBe(false)
  })

  test('tab_open carries opener_tab_id and opener_url when openerTabId is set', async ({ page }) => {
    await bootstrap(page)
    // Seed the opener tab so tabState has its currentUrl.
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 100, windowId: 1, url: 'https://news.ycombinator.com/', title: 'HN', active: true })
    })
    await page.evaluate(() => {
      ;(window as any).__resetCapturedEvents()
      ;(window as any).__fireTabCreated({
        id: 101,
        windowId: 1,
        url: 'https://example.test/article',
        title: '',
        active: false,
        openerTabId: 100,
      })
    })
    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_open')
    )
    const open = (await capturedEvents(page)).find((e) => e.event_type === 'tab_open')
    expect(open.tab_id).toBe(101)
    expect(open.opener_tab_id).toBe(100)
    expect(open.opener_url).toBe('https://news.ycombinator.com/')
    expect(open.opener_filtered).toBe(false)
  })

  test('tab_open has no opener fields when openerTabId is absent', async ({ page }) => {
    await bootstrap(page)
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 200, windowId: 1, url: 'https://example.test/direct', title: 'Direct', active: true })
    })
    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_open')
    )
    const open = (await capturedEvents(page)).find((e) => e.event_type === 'tab_open')
    expect(open.opener_tab_id).toBeUndefined()
    expect(open.opener_url).toBeUndefined()
    expect(open.opener_filtered).toBeUndefined()
  })

  test('tab_open omits opener_url when opener tab has no tracked state', async ({ page }) => {
    await bootstrap(page)
    // openerTabId references a tab we never saw created — opener_tab_id is still
    // reported (Chrome said so), but opener_url must be omitted.
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({
        id: 300,
        windowId: 1,
        url: 'https://example.test/orphan',
        title: 'Orphan',
        active: true,
        openerTabId: 999,
      })
    })
    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_open')
    )
    const open = (await capturedEvents(page)).find((e) => e.event_type === 'tab_open')
    expect(open.opener_tab_id).toBe(999)
    expect(open.opener_url).toBeUndefined()
    expect(open.opener_filtered).toBeUndefined()
  })

  test('window_close fires when chrome.windows.onRemoved is invoked', async ({ page }) => {
    await bootstrap(page)
    await page.evaluate(() => (window as any).__fireWindowRemoved(1))

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'window_close')
    )
    const wc = (await capturedEvents(page)).find((e) => e.event_type === 'window_close')
    expect(wc.window_id).toBe(1)
  })
})
