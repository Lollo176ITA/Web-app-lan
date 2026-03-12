# Routy

Routy trasforma un device nella tua rete locale in un hub LAN per file, video, audio e documenti condivisi senza passare da Internet.

## Stack
- React + Vite + Material UI per la SPA
- Node + Express per API, storage persistente e streaming locale
- SSE per aggiornamenti live della libreria
- Vitest + Supertest per API
- Playwright per end-to-end e visual QA

## Comandi
```bash
npm install
npm run dev
npm run build
npm run start
npm run desktop:start
npm run desktop:dist
npm test
npm run test:e2e
```

## URL
- Dev frontend: `http://127.0.0.1:5173`
- Dev API / runtime LAN: `http://127.0.0.1:8787`
- Produzione locale: `npm run build && npm run start`

## Storage
- I file vengono salvati in `storage/library/`
- Il manifest persistente viene scritto in `storage/index.json`

## Desktop
- `npm run desktop:start` builda client/server e apre Routy in Electron
- `npm run desktop:dist` genera un pacchetto desktop in `release/`
- `npm run desktop:dist:win` genera il pacchetto Windows `.exe` tramite target `NSIS`
- La versione desktop salva i dati in una cartella app dedicata invece che nel `storage/` del repo

## Asset visuali
- Illustrazioni fallback: `public/visuals/`
- Prompt `imagegen`: [docs/imagegen-prompts.md](/Users/lorenzo/Projects/lan-2/docs/imagegen-prompts.md)
- Screenshot usati dalla landing: `public/screenshots/`
