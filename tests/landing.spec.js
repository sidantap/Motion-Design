import { test, expect } from "@playwright/test";

async function openPortfolio(page) {
  await page.goto("/");
  const image = page.locator(".gate-photo");
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(
        (element) => element.complete && element.naturalWidth > 800,
      ),
    )
    .toBe(true);
}

const canvasSnapshot = (page) =>
  page.locator("#curtain").evaluate((canvas) => canvas.toDataURL());

test("photoreal doorway, curtain controls, sound and navigation", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openPortfolio(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "open door",
  );

  const closedCurtain = await canvasSnapshot(page);
  await page.getByRole("button", { name: "Part the chain curtain" }).click();
  await expect(
    page.getByRole("button", { name: "Close the chain curtain" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => canvasSnapshot(page)).not.toBe(closedCurtain);
  await page.getByRole("button", { name: "Enable chain sounds" }).click();
  await expect(
    page.getByRole("button", { name: "Disable chain sounds" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator("canvas").hover();
  await page.screenshot({ path: "/tmp/portfolio-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "Step into my work" }).click();
  await expect(page).toHaveURL(/#work/);
  await page.getByRole("button", { name: "Experience again" }).click();
  expect(errors).toEqual([]);
});

test("mobile keyboard interaction and stillness with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPortfolio(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  const curtain = page.getByRole("button", { name: "Part the chain curtain" });
  await curtain.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  const before = await canvasSnapshot(page);
  await page.waitForTimeout(200);
  expect(await canvasSnapshot(page)).toBe(before);
  await curtain.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Close the chain curtain" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => canvasSnapshot(page)).not.toBe(before);
  await page.screenshot({ path: "/tmp/portfolio-mobile.png", fullPage: true });
});
