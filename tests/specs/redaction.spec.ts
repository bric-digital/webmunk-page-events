import { test, expect, Page } from '@playwright/test'

async function bootstrap(page: Page, pageEventsConfig: Record<string, unknown>) {
  await page.goto('/test-page.html')
  await page.waitForFunction(() => (window as any).__pageEventsShimLoaded === true)
  await page.evaluate(() => (window as any).__rexLists.resetListDatabase())
  await page.evaluate((cfg) => {
    ;(window as any).__seedConfig(cfg)
    ;(window as any).__refreshConfig()
  }, pageEventsConfig)
  await page.waitForFunction(() =>
    (window as any).__pageEventsServiceWorker?.config !== null
  )
  await page.evaluate(() => (window as any).__resetCapturedEvents())
}

async function addListEntry(page: Page, entry: Record<string, unknown>) {
  await page.evaluate((e) => (window as any).__rexLists.createListEntry(e), entry)
}

async function capturedEvents(page: Page): Promise<any[]> {
  return page.evaluate(() => (window as any).__capturedEvents)
}

test.describe('Redaction — URL stays out but dwell stays in (real rex-lists IndexedDB)', () => {
  test('allow_lists: non-matching URL becomes CATEGORY:NOT_ON_ALLOWLIST, title omitted', async ({ page }) => {
    await bootstrap(page, { enabled: true, allow_lists: ['keeper'] })
    // Populate the allow-list with one entry that does NOT match our target URL.
    await addListEntry(page, {
      list_name: 'keeper',
      pattern: 'allowed.test',
      pattern_type: 'domain',
      source: 'backend',
      metadata: {},
    })
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 7, windowId: 1, url: 'https://not-allowed.test/', title: 'Secret', active: true })
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_open')
    )
    const open = (await capturedEvents(page)).find((e) => e.event_type === 'tab_open')
    expect(open.url).toBe('CATEGORY:NOT_ON_ALLOWLIST')
    expect(open.title).toBeUndefined()
    expect(open.filtered).toBe(true)
  })

  test('filter_lists: matching URL becomes CATEGORY:<category>, title omitted', async ({ page }) => {
    await bootstrap(page, { enabled: true, filter_lists: ['sensitive'] })
    await addListEntry(page, {
      list_name: 'sensitive',
      pattern: 'redacted.test',
      pattern_type: 'domain',
      source: 'backend',
      metadata: { category: 'health' },
    })
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 8, windowId: 1, url: 'https://redacted.test/page', title: 'Dr visit', active: true })
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_open')
    )
    const open = (await capturedEvents(page)).find((e) => e.event_type === 'tab_open')
    expect(open.url).toBe('CATEGORY:health')
    expect(open.title).toBeUndefined()
    expect(open.filtered).toBe(true)
    expect(open.filtered_by_list).toBe('sensitive')
  })

  test('domain_only_lists: URL reduced to hostname, title becomes DOMAIN ONLY', async ({ page }) => {
    await bootstrap(page, { enabled: true, domain_only_lists: ['coarse'] })
    await addListEntry(page, {
      list_name: 'coarse',
      pattern: 'coarse.test',
      pattern_type: 'domain',
      source: 'backend',
      metadata: {},
    })
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 9, windowId: 1, url: 'https://coarse.test/private-path', title: 'Private', active: true })
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_open')
    )
    const open = (await capturedEvents(page)).find((e) => e.event_type === 'tab_open')
    expect(open.url).toBe('coarse.test')
    expect(open.title).toBe('DOMAIN ONLY')
    expect(open.filtered).toBe(true)
    expect(open.filtered_by_list).toBe('coarse')
  })

  test('no lists configured: raw url + title pass through, filtered=false', async ({ page }) => {
    await bootstrap(page, { enabled: true })
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 10, windowId: 1, url: 'https://public.test/', title: 'Public', active: true })
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_open')
    )
    const open = (await capturedEvents(page)).find((e) => e.event_type === 'tab_open')
    expect(open.url).toBe('https://public.test/')
    expect(open.title).toBe('Public')
    expect(open.filtered).toBe(false)
  })

  test('INVARIANT: even fully-redacted URLs produce tab_close with non-zero focus_duration_ms', async ({ page }) => {
    await bootstrap(page, { enabled: true, filter_lists: ['block'] })
    await addListEntry(page, {
      list_name: 'block',
      pattern: 'redacted.test',
      pattern_type: 'domain',
      source: 'backend',
      metadata: { category: 'blocked' },
    })
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 11, windowId: 1, url: 'https://redacted.test/', title: 't', active: true })
    })
    await page.waitForTimeout(60)
    await page.evaluate(() => (window as any).__fireTabRemoved(11, { windowId: 1, isWindowClosing: false }))

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_close')
    )
    const close = (await capturedEvents(page)).find((e) => e.event_type === 'tab_close')
    expect(close.url).toBe('CATEGORY:blocked')
    expect(close.title).toBeUndefined()
    expect(close.focus_duration_ms).toBeGreaterThan(0)
    expect(close.tab_lifetime_ms).toBeGreaterThan(0)
  })
})
