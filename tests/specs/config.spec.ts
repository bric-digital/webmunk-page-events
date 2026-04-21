import { test, expect, Page } from '@playwright/test'

async function openAndWait(page: Page) {
  await page.goto('/test-page.html')
  await page.waitForFunction(() => (window as any).__pageEventsShimLoaded === true)
}

async function capturedEvents(page: Page): Promise<any[]> {
  return page.evaluate(() => (window as any).__capturedEvents)
}

test.describe('Configuration behavior', () => {
  test('enabled=false suppresses all events', async ({ page }) => {
    await openAndWait(page)
    await page.evaluate(() => {
      ;(window as any).__seedConfig({ enabled: false })
      ;(window as any).__refreshConfig()
    })
    await page.waitForFunction(() =>
      (window as any).__pageEventsServiceWorker?.config?.enabled === false
    )
    await page.evaluate(() => (window as any).__resetCapturedEvents())

    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 1, windowId: 1, url: 'https://a/', title: 'A', active: true })
      ;(window as any).__fireTabUpdated(1, { url: 'https://b/' }, { id: 1, windowId: 1, url: 'https://b/', title: 'B' })
      ;(window as any).__fireTabRemoved(1, { windowId: 1, isWindowClosing: false })
    })

    await page.waitForTimeout(100)
    const events = await capturedEvents(page)
    expect(events.length).toBe(0)
  })

  test('events arriving before config loads are safely ignored (no crash)', async ({ page }) => {
    await openAndWait(page)
    // Do NOT seed config. Module's config is still null.
    await page.evaluate(() => (window as any).__resetCapturedEvents())

    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 1, windowId: 1, url: 'https://a/', title: 'A', active: true })
      ;(window as any).__fireTabActivated({ tabId: 1, windowId: 1 })
      ;(window as any).__fireTabRemoved(1, { windowId: 1, isWindowClosing: false })
    })

    await page.waitForTimeout(50)
    const events = await capturedEvents(page)
    expect(events.length).toBe(0)
  })

  test('flipping from disabled to enabled starts emitting events', async ({ page }) => {
    await openAndWait(page)
    await page.evaluate(() => {
      ;(window as any).__seedConfig({ enabled: false })
      ;(window as any).__refreshConfig()
    })
    await page.waitForFunction(() =>
      (window as any).__pageEventsServiceWorker?.config?.enabled === false
    )

    await page.evaluate(() => {
      ;(window as any).__seedConfig({ enabled: true })
      ;(window as any).__refreshConfig()
    })
    await page.waitForFunction(() =>
      (window as any).__pageEventsServiceWorker?.config?.enabled === true
    )
    await page.evaluate(() => (window as any).__resetCapturedEvents())

    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 5, windowId: 1, url: 'https://late.test/', title: 'Late', active: true })
    })
    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_open')
    )
    const events = await capturedEvents(page)
    expect(events.some((e) => e.event_type === 'tab_open' && e.tab_id === 5)).toBe(true)
  })
})
