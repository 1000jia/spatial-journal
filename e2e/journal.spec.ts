import { test, expect } from "@playwright/test";
test("creates, persists, edits, undoes and recovers a draft", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("20 thoughts", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Write a thought", exact: true })
    .click();
  await page
    .getByLabel("Your thought")
    .fill("Running in the rain helped me find a quiet rhythm.");
  await page.getByLabel("Primary topic").selectOption("Running");
  await page.getByLabel("Topic tags").fill("body, quiet");
  await page.getByRole("button", { name: "Save thought", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("1 thoughts", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Exploring demo journal/ }).click();
  await expect(page.locator(".mini-note")).toContainText("Running in the rain");
  await page.locator(".mini-note").click();
  await page.getByRole("button", { name: "Open note" }).click();
  await page.getByLabel("Your thought").fill("Revised running thought.");
  await page.getByRole("button", { name: "Save thought", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Your thought")).toHaveValue(
    "Revised running thought.",
  );
  await page.getByRole("button", { name: "Close editor" }).click();
  await expect(page.locator(".mini-note")).toContainText("Running in the rain");
  await page
    .getByRole("button", { name: "Write a thought", exact: true })
    .click();
  await page
    .getByLabel("Your thought")
    .fill("An unfinished thought survives refresh.");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .getByRole("button", { name: "Write a thought", exact: true })
    .click();
  await expect(page.getByLabel("Your thought")).toHaveValue(
    "An unfinished thought survives refresh.",
  );
  expect(errors).toEqual([]);
});
test("archive navigation, mobile editor and gesture submission", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("20 thoughts", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Temporal Archive/ }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator(".archive-controls")).toContainText("2 / 20");
  await page
    .getByRole("button", { name: "Spatial timeline", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Spatial timeline", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Write a thought", exact: true })
    .click();
  await page.getByLabel("Your thought").fill("A gesture stores this thought.");
  const box = await page.locator(".drag-handle").boundingBox();
  if (!box) throw Error("No drag handle");
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 150, box.y + 10, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".mini-note")).toContainText(
    "A gesture stores this thought.",
  );
  await page.screenshot({ path: "/tmp/spatial-mobile.png", fullPage: true });
});

test("undoing a new entry recovers its draft after another refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("20 thoughts", { exact: true })).toBeVisible();
  await page.locator(".write-button").click();
  await page
    .getByLabel("Your thought")
    .fill("Keep this thought after accidental submission.");
  await page.getByRole("button", { name: "Save thought", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Your thought")).toHaveValue(
    "Keep this thought after accidental submission.",
  );
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator(".write-button").click();
  await expect(page.getByLabel("Your thought")).toHaveValue(
    "Keep this thought after accidental submission.",
  );
  await page.getByRole("button", { name: "Close editor" }).click();
  await page.getByRole("button", { name: /Exploring demo journal/ }).click();
  await expect(page.getByText("0 thoughts", { exact: true })).toBeVisible();
});
