import { expect, test } from "@playwright/test";
import path from "node:path";

const fixturesDirectory = path.resolve(process.cwd(), "tests", "fixtures");

test("landing and library manager handle folder uploads, previews, layouts, and delete", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Trasferisci file e guarda media/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Apri la LAN" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Apri la LAN" }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Libreria locale" })).toBeVisible();

  await page.locator('input[type="file"]').first().setInputFiles([
    path.join(fixturesDirectory, "sample-audio.wav"),
    path.join(fixturesDirectory, "sample-video.webm")
  ]);
  await expect(page.getByText("2 file caricati in radice LAN.")).toBeVisible();
  await expect(page.getByText("sample-audio.wav").first()).toBeVisible();
  await page.getByLabel("Azioni sample-video.webm").first().click();
  await page.getByRole("menuitem", { name: "Mostra QR code" }).click();
  await expect(page.getByRole("heading", { name: "QR code player video" })).toBeVisible();
  const qrShareUrl = await page.locator("text=/http:\\/\\/.*\\/player\\//").textContent();
  const qrVideoId = new URL(qrShareUrl ?? "").pathname.split("/").at(-1);
  expect(qrVideoId).toBeTruthy();
  await page.goto(`/player/${qrVideoId}`);
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Routeroom LAN" })).toHaveCount(0);
  await page.goto("/app");

  await page.getByRole("button", { name: "Nuova cartella" }).click();
  await page.getByLabel("Nome cartella").fill("Salotto demo");
  await page.getByRole("button", { name: "Crea" }).click();

  await expect.poll(async () => page.getByText("Salotto demo").count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: /Salotto demo/i }).first().click();

  await page.locator('input[webkitdirectory]').setInputFiles(path.join(fixturesDirectory, "sample-bundle"));
  await expect(page.getByText("3 file caricati in Salotto demo.")).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles([
    path.join(fixturesDirectory, "sample-guide.pdf"),
    path.join(fixturesDirectory, "sample-brief.docx")
  ]);
  await expect(page.getByText("2 file caricati in Salotto demo.")).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles(path.join(fixturesDirectory, "sample-note.txt"));
  await expect(page.getByText("1 file caricati in Salotto demo.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Radice" })).toHaveClass(/MuiButton-outlined/);
  await expect(page.getByRole("button", { name: "Salotto demo", exact: true })).toHaveClass(/MuiButton-contained/);

  await page.getByRole("tab", { name: "Documenti" }).click();
  await expect(page.getByText("sample-guide.pdf").first()).toBeVisible();
  await page.getByRole("tab", { name: "Tutti" }).click();
  await expect(page.getByRole("button", { name: /Minimal/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Compatto/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Descrittivo/i })).toHaveCount(0);

  await page.getByText("sample-audio.wav").first().click();
  await expect(page.locator("audio")).toBeVisible();

  await page.getByText("sample-note.txt").first().click();
  await expect(page.getByText("Routeroom tiene i file nella stessa LAN")).toBeVisible();

  await page.getByText("sample-guide.pdf").first().click();
  await expect(page.locator('iframe[title*="sample-guide.pdf"]')).toBeVisible();

  await page.getByLabel("Azioni sample-note.txt").first().click();
  await page.getByRole("menuitem", { name: "Elimina" }).click();
  await expect.poll(async () => page.getByLabel("Azioni sample-note.txt").count()).toBe(0);

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
  await pageB.getByRole("button", { name: /Secondo client.*elementi/i }).first().click();

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
    await expect(page.getByRole("heading", { name: "Libreria locale" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Seleziona file" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Carica cartella" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nuova cartella" })).toBeVisible();
    await expect(page.getByLabel("Filtro libreria")).toBeVisible();
    await expect(page.getByRole("button", { name: /Minimal/i })).toHaveCount(0);
  });
});

test("chat page stores nickname locally and syncs messages between two clients", async ({ browser, page }) => {
  const chatMessage = `Ciao dalla LAN ${Date.now()}`;

  await page.goto("/chat");
  await page.getByRole("textbox", { name: "Nickname" }).fill("Nina");
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByText("Nickname: Nina")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Nickname: Nina")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Nickname LAN" })).toHaveCount(0);

  const secondPage = await browser.newPage();
  await secondPage.goto("/chat");
  await secondPage.getByRole("textbox", { name: "Nickname" }).fill("Leo");
  await secondPage.getByRole("button", { name: "Salva" }).click();

  await page.getByLabel("Scrivi un messaggio").fill(chatMessage);
  await page.getByRole("button", { name: "Invia" }).click();

  await expect(secondPage.getByText(chatMessage)).toBeVisible();
  await secondPage.close();
});

test("stream room syncs playback and room chat across two clients", async ({ browser, page }) => {
  const roomName = `Cinema LAN ${Date.now()}`;

  await page.goto("/app");
  await page.locator('input[type="file"]').first().setInputFiles(path.join(fixturesDirectory, "sample-video.webm"));
  await expect(page.getByText("1 file caricati in radice LAN.")).toBeVisible();

  await page.goto("/stream");
  await page.getByRole("textbox", { name: "Nickname" }).fill("Host");
  await page.getByRole("button", { name: "Salva" }).click();
  await page.getByLabel("Nome stanza").fill(roomName);
  await page.getByRole("button", { name: "Crea stanza" }).click();
  await expect(page.getByText("Stanza creata.")).toBeVisible();
  await expect(page.getByText(roomName).first()).toBeVisible();
  const roomUrlFromList = await page.locator(".MuiCard-root").evaluateAll((cards, targetRoomName) => {
    for (const card of cards) {
      if (!card.textContent?.includes(targetRoomName)) {
        continue;
      }

      const link = card.querySelector("a[href*='/stream/room/']");

      if (link instanceof HTMLAnchorElement) {
        return link.href;
      }
    }

    return null;
  }, roomName);

  expect(roomUrlFromList).toBeTruthy();
  await page.goto(roomUrlFromList!);

  await expect(page.getByText(roomName).first()).toBeVisible();
  await page.getByLabel("Video stanza").click();
  await page.getByRole("option", { name: "sample-video.webm" }).last().click();
  await expect(page.getByText("Video stanza aggiornato.")).toBeVisible();
  await page.waitForTimeout(400);

  const roomUrl = page.url();
  const roomId = new URL(roomUrl).pathname.split("/").at(-1) ?? "";
  const guestPage = await browser.newPage();
  await guestPage.goto(roomUrl);
  await guestPage.getByRole("textbox", { name: "Nickname" }).fill("Guest");
  await guestPage.getByRole("button", { name: "Salva" }).click();
  await expect(guestPage.getByText(roomName).first()).toBeVisible();
  await expect(guestPage.getByLabel("Video stanza")).toContainText("sample-video.webm");

  const hostVideo = page.locator("video");
  const guestVideo = guestPage.locator("video");

  await hostVideo.evaluate(async (video: HTMLVideoElement) => {
    video.currentTime = 1;
    await video.play();
  });

  await expect(guestPage.getByText("In riproduzione").first()).toBeVisible();
  await guestVideo.evaluate(async (video: HTMLVideoElement) => {
    await video.play();
  });
  await expect.poll(async () => {
    const state = await guestVideo.evaluate((video: HTMLVideoElement) => ({
      currentTime: video.currentTime,
      paused: video.paused
    }));

    return state.currentTime > 0.5 && state.paused === false;
  }).toBe(true);

  await hostVideo.evaluate((video: HTMLVideoElement) => {
    video.pause();
  });

  await expect.poll(async () => guestVideo.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  await page.waitForTimeout(300);

  await page.evaluate(async ({ currentRoomId }) => {
    await fetch(`/api/stream/rooms/${currentRoomId}/playback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "seek",
        positionSeconds: 2.2
      })
    });
  }, { currentRoomId: roomId });

  await expect.poll(async () => guestPage.evaluate(async ({ currentRoomId }) => {
    const response = await fetch(`/api/stream/rooms/${currentRoomId}`);
    const data = await response.json();
    return data.room.playback.positionSeconds as number;
  }, { currentRoomId: roomId })).toBeGreaterThan(1.5);

  await guestPage.getByLabel("Messaggio stanza").fill("Pronto alla visione");
  await guestPage.getByRole("button", { name: "Invia" }).click();
  await expect(page.getByText("Pronto alla visione")).toBeVisible();

  await page.getByRole("button", { name: "Elimina stanza" }).click();
  await expect(page).toHaveURL(/\/stream$/);
  await expect.poll(async () => guestPage.getByText("Stanza non trovata.").count()).toBeGreaterThan(0);
  await guestPage.close();
});
