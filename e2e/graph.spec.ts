import { test, expect, type Page } from "@playwright/test";
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on("pageerror", (e) => errors.get(page)!.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function write(page: Page, text: string, keywords: string) {
  await page.locator(".write-button").click();
  await page.getByLabel("Your thought").fill(text);
  await page.getByLabel("Concept keywords").fill(keywords);
  await page.getByRole("button", { name: "Save thought", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
const node = (page: Page, label: string) =>
  page.getByRole("button", { name: `Concept: ${label}`, exact: true });
const connection = (page: Page, a: string, b: string) =>
  page.getByRole("button", {
    name: new RegExp(`^Connection: (${a} — ${b}|${b} — ${a})$`),
  });
test("keyword nodes, one/two hop focus, evidence, exclusion and manual relationships persist", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("20 thoughts", { exact: true })).toBeVisible();
  await write(page, "First source about alpha and beta.", "alpha, beta");
  await write(page, "Second source about beta and gamma.", "beta, gamma");
  await write(page, "Third source about gamma and delta.", "gamma, delta");
  await write(page, "Another alpha and beta observation.", "Alpha, beta, beta");
  await expect(page.locator("[data-node]")).toHaveCount(4);
  const svg = page.getByRole("group", {
    name: "Keyword knowledge graph",
    exact: true,
  });
  const originalView = await svg.getAttribute("viewBox");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(svg).not.toHaveAttribute("viewBox", originalView!);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect(svg).toHaveAttribute("viewBox", originalView!);
  await svg.scrollIntoViewIfNeeded();
  const bounds = await svg.boundingBox();
  if (!bounds) throw Error("Missing SVG");
  await page.mouse.move(bounds.x + 30, bounds.y + bounds.height - 60);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 100, bounds.y + bounds.height - 40, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(svg).not.toHaveAttribute("viewBox", originalView!);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await node(page, "alpha").locator("circle").click();
  await expect(node(page, "alpha")).toHaveAttribute("aria-pressed", "true");
  await expect(node(page, "gamma")).toHaveAttribute("opacity", "0.12");
  await page.getByLabel("Neighborhood depth").selectOption("2");
  await expect(node(page, "gamma")).toHaveAttribute("opacity", "1");
  await expect(node(page, "delta")).toHaveAttribute("opacity", "0.12");
  await page.getByLabel("Neighborhood depth").selectOption("Infinity");
  await expect(node(page, "delta")).toHaveAttribute("opacity", "1");
  await connection(page, "alpha", "beta").press("Enter");
  const evidence = page.getByRole("region", { name: "Connection evidence" });
  await expect(evidence).toContainText("Co-occurrence, not causation.");
  await expect(evidence.locator("dd").first()).toHaveText("2");
  await expect(evidence.locator(".source-note")).toHaveCount(2);
  await evidence
    .getByRole("button", { name: "Exclude connection", exact: true })
    .click();
  await expect(connection(page, "alpha", "beta")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /Exploring demo journal/ }).click();
  await page.getByText("Excluded connections (1)", { exact: true }).click();
  await page.locator(".excluded-list button").click();
  await expect(
    page
      .getByRole("region", { name: "Connection evidence" })
      .locator("dd")
      .last(),
  ).toHaveText("Yes");
  await page
    .getByRole("button", { name: "Restore connection", exact: true })
    .click();
  await expect(connection(page, "alpha", "beta")).toHaveCount(1);
  await node(page, "alpha").press("Enter");
  await page.getByText("Merge or connect concepts", { exact: true }).click();
  await page.getByLabel("Target concept").selectOption({ label: "delta" });
  await page
    .getByRole("button", { name: "Create manual connection", exact: true })
    .click();
  await connection(page, "alpha", "delta").press("Enter");
  await expect(
    page
      .getByRole("region", { name: "Connection evidence" })
      .locator("dd")
      .first(),
  ).toHaveText("0");
  await expect(
    page.getByRole("region", { name: "Connection evidence" }),
  ).toContainText("No source notes.");
  await page.getByRole("button", { name: "Exit focus", exact: true }).click();
  await expect(node(page, "delta")).toHaveAttribute("opacity", "1");
});
test("concept rename, split, merge, delete, keyword edits and dragged positions survive refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("20 thoughts", { exact: true })).toBeVisible();
  await write(page, "First focus observation.", "focus, rest");
  await write(page, "Second focus observation.", "focus, rest");
  await node(page, "focus").press("Enter");
  await page.getByLabel("Concept name", { exact: true }).fill("attention");
  await page
    .getByRole("button", { name: "Rename concept", exact: true })
    .click();
  await expect(node(page, "attention")).toHaveCount(1);
  await page.getByText("Split concept by notes", { exact: true }).click();
  await page.getByLabel("Split concept name").fill("deep work");
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("button", { name: "Split selected notes", exact: true })
    .click();
  await expect(node(page, "deep work")).toHaveCount(1);
  await expect(node(page, "attention")).toHaveCount(1);
  await node(page, "deep work").press("Enter");
  await page.getByText("Merge or connect concepts", { exact: true }).click();
  await page.getByLabel("Target concept").selectOption({ label: "attention" });
  await page
    .getByRole("button", { name: "Merge into target", exact: true })
    .click();
  await expect(node(page, "deep work")).toHaveCount(0);
  await node(page, "attention").scrollIntoViewIfNeeded();
  const before = await node(page, "attention").getAttribute("transform");
  const circle = await node(page, "attention").locator("circle").boundingBox();
  if (!circle) throw Error("Missing node");
  await page.mouse.move(
    circle.x + circle.width / 2,
    circle.y + circle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    circle.x + circle.width / 2 + 70,
    circle.y + circle.height / 2 + 35,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect(page.locator(".graph-workspace")).not.toBeDisabled();
  const after = await node(page, "attention").getAttribute("transform");
  expect(after).not.toBe(before);
  const draggedId = await node(page, "attention").getAttribute("data-node");
  await expect
    .poll(async () =>
      page.evaluate(async (id) => {
        const { storage } = await import("/src/storage.ts");
        const graph = await storage.loadGraph();
        const c = graph.concepts.find((c) => c.id === id)!;
        return `translate(${c.x},${c.y})`;
      }, draggedId),
    )
    .toBe(after);
  await page.reload();
  await page.getByRole("button", { name: /Exploring demo journal/ }).click();
  await expect(node(page, "attention")).toHaveAttribute("transform", after!);
  await node(page, "rest").press("Enter");
  await page
    .getByRole("button", { name: "Delete concept", exact: true })
    .click();
  await expect(node(page, "rest")).toHaveCount(0);
  await expect(page.locator(".mini-note")).toHaveCount(2);
  await page.locator(".mini-note").first().click();
  await page.getByRole("button", { name: "Open note", exact: true }).click();
  await page.getByLabel("Concept keywords").fill("attention, recovery");
  await page.getByRole("button", { name: "Save thought", exact: true }).click();
  await expect(node(page, "recovery")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: /Exploring demo journal/ }).click();
  await expect(node(page, "rest")).toHaveCount(0);
  await expect(node(page, "recovery")).toHaveCount(1);
  await page.locator(".mini-note").first().click();
  await page.getByRole("button", { name: "Open note", exact: true }).click();
  await page.getByLabel("Concept keywords").fill("");
  await page.getByRole("button", { name: "Save thought", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".mini-note").first()).toContainText(
    "No concepts assigned",
  );
});
test("topic creation, rename, color, merge and deletion preserve concepts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("20 thoughts", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Exploring demo journal/ }).click();
  await page
    .getByRole("button", { name: "Manage topics", exact: true })
    .click();
  await page.getByLabel("New topic name").fill("Wellbeing");
  await page.getByLabel("New topic color").fill("#123456");
  await page.getByRole("button", { name: "Add topic", exact: true }).click();
  await expect(
    page.getByLabel("Topic name Wellbeing", { exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Knowledge Graph", exact: true })
    .click();
  await page.getByLabel("New concept name").fill("calm");
  await page
    .getByLabel("New concept topic")
    .selectOption({ label: "Wellbeing" });
  await page.getByRole("button", { name: "Add concept", exact: true }).click();
  await expect(node(page, "calm").locator("circle")).toHaveAttribute(
    "fill",
    "#123456",
  );
  await page
    .getByRole("button", { name: "Manage topics", exact: true })
    .click();
  const row = page
    .locator(".theme-row")
    .filter({ has: page.getByLabel("Topic name Wellbeing", { exact: true }) });
  await row.getByLabel("Topic name Wellbeing", { exact: true }).fill("Health");
  await row
    .getByLabel("Topic color Wellbeing", { exact: true })
    .fill("#654321");
  await row.getByRole("button", { name: "Save topic", exact: true }).click();
  await expect(
    page.getByLabel("Topic name Health", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Exploring demo journal/ }).click();
  await page
    .getByRole("button", { name: "Manage topics", exact: true })
    .click();
  await expect(
    page.getByLabel("Topic name Health", { exact: true }),
  ).toHaveValue("Health");
  await expect(
    page.getByLabel("Topic color Health", { exact: true }),
  ).toHaveValue("#654321");
  const renamed = page
    .locator(".theme-row")
    .filter({ has: page.getByLabel("Topic name Health", { exact: true }) });
  await renamed
    .getByLabel("Replacement for Health", { exact: true })
    .selectOption({ label: "Reflection" });
  await renamed
    .getByRole("button", { name: "Merge topic", exact: true })
    .click();
  await expect(
    page.getByLabel("Topic name Health", { exact: true }),
  ).toHaveCount(0);
  const reflection = page
    .locator(".theme-row")
    .filter({ has: page.getByLabel("Topic name Reflection", { exact: true }) });
  await reflection
    .getByLabel("Replacement for Reflection", { exact: true })
    .selectOption({ label: "Running" });
  await reflection
    .getByRole("button", { name: "Delete topic and reassign", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Knowledge Graph", exact: true })
    .click();
  await expect(node(page, "calm")).toHaveCount(1);
  await node(page, "calm").press("Enter");
  await expect(
    page.getByLabel("Concept topic", { exact: true }).locator("option:checked"),
  ).toHaveText("Running");
});
test("migrates an actual v1 browser database and preserves old draft and undo", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("20 thoughts", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const { storage } = await import("/src/storage.ts");
    await storage.close();
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.deleteDatabase("spatial-journal");
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("spatial-journal", 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("entries", { keyPath: "id" });
        r.result.createObjectStore("settings");
      };
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction(["entries", "settings"], "readwrite");
        const old = {
          id: "legacy-note",
          text: "跑步与心理健康的旧笔记",
          createdAt: "2026-09-01T08:00:00.000Z",
          updatedAt: "2026-09-01T08:00:00.000Z",
          primaryTopic: "Running",
          tags: [],
          keywords: ["跑步", "心理健康"],
          coordinates: [1, 2, 3],
          related: [],
          archived: false,
          demo: false,
        };
        tx.objectStore("entries").put(old);
        tx.objectStore("settings").put(true, "seeded");
        tx.objectStore("settings").put(
          { text: "旧版本未完成草稿", topic: "Running", tags: "" },
          "draft",
        );
        tx.objectStore("settings").put({ saved: old }, "undo");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      r.onerror = () => reject(r.error);
    });
  });
  await page.reload();
  await page.getByRole("button", { name: /Exploring demo journal/ }).click();
  await expect(node(page, "跑步")).toHaveCount(1);
  await expect(page.locator(".mini-note")).toContainText(
    "跑步与心理健康的旧笔记",
  );
  await page.locator(".write-button").click();
  await expect(page.getByLabel("Your thought")).toHaveValue("旧版本未完成草稿");
  await page.getByRole("button", { name: "Close editor" }).click();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeVisible();
});
