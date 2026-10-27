// After Continue on the Clips page: the stand-in AI can't look at clips, so a
// pop-up says so first; "Continue anyway" goes on to the script.
export async function afterClipsContinue(page) {
  const anyway = page.getByRole('button', { name: 'Continue anyway' })
  await Promise.race([page.waitForURL(/\/script$/, { timeout: 30000 }), anyway.waitFor({ timeout: 30000 })])
  if (await anyway.isVisible()) await anyway.click()
  await page.waitForURL(/\/script$/)
}
