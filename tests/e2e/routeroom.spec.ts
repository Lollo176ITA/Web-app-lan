import { expect, test } from "@playwright/test";
import path from "node:path";

const fixturesDirectory = path.resolve(process.cwd(), "tests", "fixtures");

test("landing and library manager handle folder uploads, previews, layouts, and delete", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Trasferisci file e guarda media/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Apri la LAN" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Apri la LAN" }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Hub locale con cartelle, preview documenti e media condivisi")).toBeVisible();

  await page.locator('input[type="file"]').first().setInputFiles(path.join(fixturesDirectory, "sample-audio.wav"));
  await expect(page.getByText("1 file caricati in radice LAN.")).toBeVisible();
  await expect(page.getByText("sample-audio.wav").first()).toBeVisible();

  await page.getByRole("button", { name: "Nuova cartella" }).click();
  await page.getByLabel("Nome cartella").fill("Salotto demo");
  await page.getByRole("button", { name: "Crea" }).click();

  await expect.poll(async () => page.getByText("Salotto demo").count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: /Salotto demo/i }).first().click();

  await page.locator('input[webkitdirectory]').setInputFiles(path.join(fixturesDirectory, "sample-bundle"));

  await expect(page.getByText("3 file caricati in Salotto demo.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Cartella sample-bundle/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Radice" })).toHaveClass(/MuiButton-outlined/);
  await expect(page.getByRole("button", { name: "Salotto demo", exact: true })).toHaveClass(/MuiButton-contained/);

  await page.getByLabel("Azioni sample-bundle").first().click();
  await expect(page.getByRole("menuitem", { name: /Scarica cartella/i })).toBeVisible();
  const folderDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Scarica cartella/i }).click();
  expect((await folderDownload).suggestedFilename()).toContain("sample-bundle.zip");

  await page.getByLabel("Azioni sample-bundle").first().click();
  await expect(page.getByRole("menuitem", { name: /Crea archivio RAR/i })).toBeDisabled();
  await page.getByRole("menuitem", { name: /Crea archivio ZIP/i }).click();
  await expect(page.getByText("Archivio creato: sample-bundle.zip.")).toBeVisible();
  await expect(page.getByText("sample-bundle.zip").first()).toBeVisible();

  await page.getByRole("tab", { name: "Documenti" }).click();
  await expect(page.getByRole("button", { name: /Cartella sample-bundle/i })).toHaveCount(0);
  await page.getByRole("tab", { name: "Tutti" }).click();
  await page.getByRole("button", { name: /Descrittivo/i }).click();
  await expect(page.getByRole("button", { name: /Descrittivo/i })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Minimal/i }).click();
  await expect(page.getByRole("button", { name: /Minimal/i })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /sample-bundle/i }).first().click();
  await page.getByRole("button", { name: /Guide/i }).first().click();
  await expect(page.getByRole("button", { name: "Radice" })).toHaveClass(/MuiButton-outlined/);
  await expect(page.getByRole("button", { name: "Salotto demo", exact: true })).toHaveClass(/MuiButton-outlined/);
  await expect(page.getByRole("button", { name: "sample-bundle", exact: true })).toHaveClass(/MuiButton-outlined/);
  await expect(page.getByRole("button", { name: "Guide", exact: true })).toHaveClass(/MuiButton-contained/);

  await page.getByText("sample-audio.wav").first().click();
  await expect(page.locator("audio")).toBeVisible();

  await page.getByText("sample-note.txt").first().click();
  await expect(page.getByText("Routeroom tiene i file nella stessa LAN")).toBeVisible();

  await page.getByText("sample-guide.pdf").first().click();
  await expect(page.locator('iframe[title*="sample-guide.pdf"]')).toBeVisible();

  await page.getByLabel("Azioni sample-note.txt").first().click();
  await page.getByRole("menuitem", { name: "Elimina" }).click();
  await expect.poll(async () => page.getByLabel("Azioni sample-note.txt").count()).toBe(0);

  await page.getByRole("button", { name: /sample-bundle/i }).first().click();
  await page.getByRole("button", { name: /Docs/i }).first().click();
  await page.getByText("sample-brief.docx").first().click();
  await expect(page.getByText("Brief Routeroom")).toBeVisible();
});

test("library updates propagate to a second client through SSE", async ({ browser }) => {
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();

  await Promise.all([pageA.goto("/app"), pageB.goto("/app")]);

  await pageA.getByRole("button", { name: "Nuova cartella" }).click();
  await pageA.getByLabel("Nome cartella").fill("Secondo client");
  await pageA.getByRole("button", { name: "Crea" }).click();
  await expect.poll(async () => pageA.getByText("Secondo client").count()).toBeGreaterThan(0);
  await pageA.getByRole("button", { name: /Secondo client/i }).first().click();

  await expect.poll(async () => pageB.getByText("Secondo client").count()).toBeGreaterThan(0);
  await pageB.getByRole("button", { name: /Cartella Secondo client/i }).first().click();

  const beforeCount = await pageB.getByText("sample-note.txt").count();
  await pageA.locator('input[type="file"]').first().setInputFiles(path.join(fixturesDirectory, "sample-note.txt"));
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
    await expect(page.getByRole("button", { name: "Carica cartella" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nuova cartella" })).toBeVisible();
    await expect(page.getByLabel("Filtro libreria")).toBeVisible();
    await expect(page.getByRole("button", { name: /Minimal/i })).toBeVisible();
  });
});
