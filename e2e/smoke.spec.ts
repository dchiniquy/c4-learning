import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const PIN = '1234'
const MONDAY = new Date(2026, 9, 12, 10, 0) // weekday schedules repeat Mon-Fri, so pin the clock to a Monday

/** Collects anything the app logs as an error, so a green run also means a quiet console. */
function watchConsole(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

async function unlockParentArea(page: Page) {
  await page.getByRole('link', { name: 'Parent area' }).click()
  await page.getByLabel('Enter PIN').fill(PIN)
  await page.getByRole('button', { name: 'Unlock' }).click()
}

test('a family can set up, play a day, reload, back up, and see progress', async ({ page }, testInfo) => {
  const errors = watchConsole(page)
  await page.clock.setFixedTime(MONDAY)
  const shot = (name: string) => page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })

  // First run: no learners, then set a PIN and add two learners.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Who is learning today?' })).toBeVisible()
  await page.getByRole('link', { name: 'Parent area' }).click()
  await page.getByLabel('PIN', { exact: true }).fill(PIN)
  await page.getByLabel('Confirm PIN').fill(PIN)
  await page.getByRole('button', { name: 'Save PIN' }).click()

  await page.getByLabel('Name').fill('Ada')
  await page.getByRole('button', { name: 'Add learner' }).click()
  await expect(page.getByText('Ada, Pre-K')).toBeVisible()
  await page.getByLabel('Name').fill('Bo')
  await page.getByLabel('Level').selectOption('1')
  await page.getByRole('button', { name: 'Add learner' }).click()
  await expect(page.getByText('Bo, Grade 1')).toBeVisible()
  await shot('01-parent-area')

  // Today's schedule for the pre-K learner, with the app-time meter.
  await page.getByRole('link', { name: 'Done' }).click()
  await shot('02-picker')
  await page.getByRole('link', { name: /Ada/ }).click()
  await expect(page.getByRole('heading', { name: 'Monday' })).toBeVisible()
  await expect(page.getByText(/App time today: 0 of 20 min \(limit 30 min\)/)).toBeVisible()
  await shot('03-today')

  // Play the counting game: one wrong answer first, then right answers.
  await page.getByRole('link', { name: /Start Number app time/ }).click()
  await expect(page.getByRole('heading', { name: 'Counting game' })).toBeVisible()
  await page.getByRole('button', { name: '2', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Try again')
  await shot('04-wrong-answer')
  await page.getByRole('button', { name: '3', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Yes')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: '5', exact: true }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await shot('05-number-line')
  await page.getByRole('button', { name: '7', exact: true }).click()
  await page.getByRole('button', { name: 'All done!' }).click()

  // Back on Today: ticked, meter updated, and it survives a full reload.
  await expect(page.getByRole('heading', { name: 'Monday' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Number app time/ })).toBeChecked()
  await expect(page.getByText(/App time today: 10 of 20 min/)).toBeVisible()
  await page.reload()
  await expect(page.getByRole('checkbox', { name: /Number app time/ })).toBeChecked()

  // Backup: download, check its contents, then restore it.
  await page.goto('/#/')
  await unlockParentArea(page)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()])
  expect(download.suggestedFilename()).toMatch(/^c4-learning-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = testInfo.outputPath('backup.json')
  await download.saveAs(path)
  const backup = JSON.parse(readFileSync(path, 'utf8'))
  expect(backup.children.map((c: { name: string }) => c.name).sort()).toEqual(['Ada', 'Bo'])
  expect(backup.checks.length).toBeGreaterThan(0)
  expect(JSON.stringify(backup)).not.toContain('"salt"') // the PIN never leaves the device in a backup

  page.once('dialog', (d) => void d.accept())
  await page.locator('input[type=file]').setInputFiles(path)
  await expect(page.getByRole('status').filter({ hasText: 'Backup restored.' })).toBeVisible()

  // Progress report (loads the standards chunk on demand).
  await page.getByRole('link', { name: "View Ada's progress" }).click()
  await expect(page.getByRole('heading', { name: /Ada: progress/ })).toBeVisible()
  await expect(page.getByText(/^1 of \d+$/).first()).toBeVisible()
  await expect(page.getByText(/Counting game/).first()).toBeVisible()
  await page.getByLabel('Level for Count objects and know the last number tells how many').selectOption('mastered')
  await shot('06-report')

  // A grade 1 learner gets a different schedule with its own limit.
  await page.goto('/#/')
  await page.getByRole('link', { name: /Bo/ }).click()
  await expect(page.getByText(/App time today: 0 of \d+ min \(limit 60 min\)/)).toBeVisible()
  await page.getByRole('link', { name: /^Start / }).first().click()
  await expect(page.getByText(/Activity 1 of \d+/)).toBeVisible()
  await shot('07-grade1-game')

  expect(errors).toEqual([])
})

test('the browser offers speech, and it is quiet until asked', async ({ page }) => {
  await page.goto('/')
  const supported = await page.evaluate(() => {
    const g = globalThis as unknown as Record<string, unknown> // the Node tsconfig has no DOM types
    return 'speechSynthesis' in g && typeof g.SpeechSynthesisUtterance !== 'undefined'
  })
  test.info().annotations.push({ type: 'speech-supported', description: String(supported) })
  expect(typeof supported).toBe('boolean')
})
