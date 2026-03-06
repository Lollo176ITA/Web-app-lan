import { expect, test } from "@playwright/test";
import path from "node:path";

const fixturesDirectory = path.resolve(process.cwd(), "tests", "fixtures");

test("landing and app shell handle local media flows", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Trasferisci file e guarda media/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Apri la LAN" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Apri la LAN" }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Hub locale per file, video e media condivisi")).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles([
    path.join(fixturesDirectory, "sample-video.webm"),
    path.join(fixturesDirectory, "sample-photo.svg"),
    path.join(fixturesDirectory, "sample-audio.wav"),
    path.join(fixturesDirectory, "sample-note.txt")
  ]);

  await expect(page.getByText("4 file caricati in LAN.")).toBeVisible();
  await expect(page.locator("h6").filter({ hasText: "sample-video.webm" }).first()).toBeVisible();
  await expect(page.locator("h6").filter({ hasText: "sample-photo.svg" }).first()).toBeVisible();
  await expect(page.locator("h6").filter({ hasText: "sample-audio.wav" }).first()).toBeVisible();
  await expect(page.locator("h6").filter({ hasText: "sample-note.txt" }).first()).toBeVisible();

  await page.locator("h6").filter({ hasText: "sample-video.webm" }).first().click();
  const videoPlayer = page.locator("video");
  await expect(videoPlayer).toBeVisible();
  const videoSource = await videoPlayer.evaluate((element) => {
    const media = element as HTMLVideoElement;
    return media.currentSrc;
  });
  expect(videoSource).toContain("/api/items/");
  const streamResponse = await page.evaluate(async (resource) => {
    const response = await fetch(resource, {
      headers: {
        Range: "bytes=0-31"
      }
    });

    return {
      status: response.status,
      type: response.headers.get("content-type")
    };
  }, videoSource);
  expect(streamResponse.status).toBe(206);
  expect(streamResponse.type).toContain("video/");

  await page.locator("h6").filter({ hasText: "sample-photo.svg" }).first().click();
  await expect(page.locator('img[alt="sample-photo.svg"]').last()).toBeVisible();

  await page.locator("h6").filter({ hasText: "sample-audio.wav" }).first().click();
  await expect(page.locator("audio")).toBeVisible();

  await page.locator("h6").filter({ hasText: "sample-note.txt" }).first().click();
  await expect(page.getByRole("link", { name: "Scarica" })).toBeVisible();
});

test("library updates propagate to a second client through SSE", async ({ browser }) => {
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();

  await Promise.all([pageA.goto("/app"), pageB.goto("/app")]);
  const noteCards = pageB.locator("h6").filter({ hasText: "sample-note.txt" });
  const initialCount = await noteCards.count();

  await pageA.locator('input[type="file"]').setInputFiles(path.join(fixturesDirectory, "sample-note.txt"));
  await expect(pageA.getByText("1 file caricati in LAN.")).toBeVisible();
  await expect.poll(async () => noteCards.count()).toBeGreaterThan(initialCount);
  const afterFirstUploadCount = await noteCards.count();

  const duplicateName = path.join(fixturesDirectory, "sample-note.txt");
  await pageA.locator('input[type="file"]').setInputFiles(duplicateName);
  await expect.poll(async () => noteCards.count()).toBeGreaterThan(afterFirstUploadCount);

  await pageA.close();
  await pageB.close();
});

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps primary controls visible on smartphone", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Routeroom LAN" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Seleziona file" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vai alla libreria" })).toBeVisible();
    await expect(page.getByLabel("Filtro libreria")).toBeVisible();
  });
});
