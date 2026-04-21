import { test, expect, Page } from '@playwright/test'

async function bootstrap(page: Page) {
  await page.goto('/test-page.html')
  await page.waitForFunction(() => (window as any).__pageEventsShimLoaded === true)
  await page.evaluate(() => {
    ;(window as any).__seedConfig({ enabled: true })
    ;(window as any).__refreshConfig()
  })
  // Give the async refreshConfiguration Promise a chance to resolve.
  await page.waitForFunction(() =>
    (window as any).__pageEventsServiceWorker?.config !== null
  )
  await page.evaluate(() => (window as any).__resetCapturedEvents())
}

async function capturedEvents(page: Page): Promise<any[]> {
  return page.evaluate(() => (window as any).__capturedEvents)
}

test.describe('Browser-originated events (page lifecycle)', () => {
  test('pageshow forwards and becomes page_show event', async ({ page }) => {
    await bootstrap(page)

    // Seed a tab state that matches the fake sender.
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 100, windowId: 1, url: 'https://example.test/', title: 't', active: true })
    })
    await page.evaluate(() => (window as any).__resetCapturedEvents())

    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }))
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'page_show')
    )
    const events = await capturedEvents(page)
    const pageShow = events.find((e) => e.event_type === 'page_show')
    expect(pageShow).toBeDefined()
    expect(pageShow.name).toBe('rex-page-event')
    expect(pageShow.session_id).toBeTruthy()
    expect(pageShow.tab_id).toBe(100)
    expect(pageShow.persisted).toBe(false)
  })

  test('pagehide forwards and becomes page_hide event', async ({ page }) => {
    await bootstrap(page)
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 100, windowId: 1, url: 'https://example.test/', title: 't', active: true })
      ;(window as any).__resetCapturedEvents()
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'page_hide')
    )
    const events = await capturedEvents(page)
    const pageHide = events.find((e) => e.event_type === 'page_hide')
    expect(pageHide.persisted).toBe(true)
  })

  test('window.focus and window.blur become tab_focus / tab_blur events', async ({ page }) => {
    await bootstrap(page)
    await page.evaluate(() => {
      ;(window as any).__fireTabCreated({ id: 100, windowId: 1, url: 'https://example.test/', title: 't', active: true })
      ;(window as any).__resetCapturedEvents()
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('blur'))
    })

    await page.waitForFunction(() =>
      (window as any).__capturedEvents.some((e: any) => e.event_type === 'tab_blur')
    )
    const events = await capturedEvents(page)
    expect(events.some((e) => e.event_type === 'tab_focus')).toBe(true)
    expect(events.some((e) => e.event_type === 'tab_blur')).toBe(true)
  })
})
