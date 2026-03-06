import { expect, test } from "@playwright/test";
import path from "node:path";

const fixturesDirectory = path.resolve(process.cwd(), "tests", "fixtures");

test("landing and library manager handle folders, previews, layouts, and delete", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Trasferisci file e guarda media/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Apri la LAN" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Apri la LAN" }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Hub locale con cartelle, preview documenti e media condivisi")).toBeVisible();
  await expect(page.getByRole("button", { name: /Cartella Esempio Routeroom/i }).first()).toBeVisible();

  await page.getByRole("button", { name: "Nuova cartella" }).click();
  await page.getByLabel("Nome cartella").fill("Salotto demo");
  await page.getByRole("button", { name: "Crea" }).click();

  await expect(page.getByText("Cartella: Salotto demo")).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles([
    path.join(fixturesDirectory, "sample-note.txt"),
    path.join(fixturesDirectory, "sample-brief.docx"),
    path.join(fixturesDirectory, "sample-guide.pdf")
  ]);

  await expect(page.getByText("3 file caricati in Salotto demo.")).toBeVisible();
  await expect(page.getByText("sample-note.txt").first()).toBeVisible();
  await expect(page.getByText("sample-brief.docx").first()).toBeVisible();
  await expect(page.getByText("sample-guide.pdf").first()).toBeVisible();

  await page.getByRole("button", { name: /Descrittivo/i }).click();
  await expect(page.getByRole("button", { name: /Descrittivo/i })).toHaveAttribute("aria-pressed", "true");

  await page.getByText("sample-note.txt").first().click();
  await expect(page.getByText("Anteprima testo")).toBeVisible();
  await expect(page.getByText("Routeroom tiene i file nella stessa LAN")).toBeVisible();

  await page.getByText("sample-brief.docx").first().click();
  await expect(page.getByText("Anteprima Word")).toBeVisible();
  await expect(page.getByText("Brief Routeroom")).toBeVisible();

  await page.getByText("sample-guide.pdf").first().click();
  await expect(page.locator('iframe[title*="sample-guide.pdf"]')).toBeVisible();

  await page.getByLabel("Elimina sample-note.txt").click();
  await expect.poll(async () => page.getByText("sample-note.txt").count()).toBe(0);
});

test("library updates propagate to a second client through SSE", async ({ browser }) => {
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();

  await Promise.all([pageA.goto("/app"), pageB.goto("/app")]);

  await pageA.getByRole("button", { name: "Nuova cartella" }).click();
  await pageA.getByLabel("Nome cartella").fill("Secondo client");
  await pageA.getByRole("button", { name: "Crea" }).click();
  await expect(pageA.getByText("Cartella: Secondo client")).toBeVisible();

  await expect.poll(async () => pageB.getByText("Secondo client").count()).toBeGreaterThan(0);
  await pageB.getByRole("button", { name: /Cartella Secondo client/i }).first().click();

  const beforeCount = await pageB.getByText("sample-note.txt").count();
  await pageA.locator('input[type="file"]').setInputFiles(path.join(fixturesDirectory, "sample-note.txt"));
  await expect(pageA.getByText("1 file caricati in Secondo client.")).toBeVisible();
  await expect.poll(async () => pageB.getByText("sample-note.txt").count()).toBeGreaterThan(beforeCount);

  await pageA.close();
  await pageB.close();
});

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps explorer and primary controls visible on smartphone", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Routeroom LAN" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Seleziona file" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nuova cartella" })).toBeVisible();
    await expect(page.getByLabel("Filtro libreria")).toBeVisible();
    await expect(page.getByRole("button", { name: /Compatto/i })).toBeVisible();
  });
});
