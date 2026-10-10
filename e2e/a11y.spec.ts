import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const PIN = '1234'
const MONDAY = new Date(2026, 9, 12, 10, 0)

/** WCAG 2.1 A/AA rules, as the app is used by young children and their grown-ups. */
async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length} node(s)] e.g. ${v.nodes[0]?.target.join(' ')} — ${v.nodes[0]?.any[0]?.message ?? v.nodes[0]?.failureSummary ?? ''}`)
  expect(summary, `accessibility problems on ${name}`).toEqual([])
}

for (const scheme of ['light', 'dark'] as const) {
  test(`key screens have no WCAG A/AA violations (${scheme})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.clock.setFixedTime(MONDAY)

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Who is learning today?' })).toBeVisible()
    await audit(page, 'picker (empty)')

    await page.getByRole('link', { name: 'Parent area' }).click()
    await audit(page, 'PIN setup')
    await page.getByLabel('PIN', { exact: true }).fill(PIN)
    await page.getByLabel('Confirm PIN').fill(PIN)
    await page.getByRole('button', { name: 'Save PIN' }).click()
    await page.getByLabel('Name').fill('Ada')
    await page.getByRole('button', { name: 'Add learner' }).click()
    await expect(page.getByText('Ada, Pre-K')).toBeVisible()
    await audit(page, 'parent area')

    await page.getByRole('link', { name: 'Done' }).click()
    await audit(page, 'picker')
    await page.getByRole('link', { name: /Ada/ }).click()
    await expect(page.getByText('Next up')).toBeVisible()
    await audit(page, 'child home')
    await page.screenshot({ path: testInfo.outputPath(`child-home-${scheme}.png`) })

    await page.getByRole('link', { name: 'Grown-up plan' }).click()
    await expect(page.getByRole('heading', { name: 'Monday' })).toBeVisible()
    await page.getByText(/For the grown-up: Clap your name/).click() // open a details panel
    await audit(page, 'grown-up plan')

    await page.getByRole('link', { name: /Start Number app time/ }).click()
    await expect(page.getByRole('heading', { name: 'Counting game' })).toBeVisible()
    await audit(page, 'game: multiple choice')
    await page.getByRole('button', { name: '2', exact: true }).click() // wrong answer feedback
    await audit(page, 'game: feedback')
    await page.screenshot({ path: testInfo.outputPath(`game-${scheme}.png`) })
    await page.getByRole('button', { name: '3', exact: true }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: '5', exact: true }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await audit(page, 'game: number line')
    await page.getByRole('button', { name: '7', exact: true }).click()
    await page.getByRole('button', { name: 'All done!' }).click()

    await page.getByRole('link', { name: 'Switch learner' }).click()
    await page.getByRole('link', { name: 'Parent area' }).click()
    await page.getByLabel('Enter PIN').fill(PIN)
    await audit(page, 'PIN entry')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await page.getByRole('link', { name: "View Ada's progress" }).click()
    await expect(page.getByRole('heading', { name: /Ada: progress/ })).toBeVisible()
    await audit(page, 'progress report')
  })
}
