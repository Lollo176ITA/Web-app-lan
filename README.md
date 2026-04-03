# Routy

Routy e una web app, con wrapper desktop Electron, che trasforma un host della rete locale in un relay per file, media, chat e watch party senza passare da Internet.

L'idea del progetto e semplice:

1. un host avvia Routy sulla LAN
2. Routy espone un URL locale raggiungibile dagli altri device
3. gli altri client aprono il browser e accedono a libreria, player, chat e stanze streaming
4. file, stato playback e messaggi restano persistenti sull'host

## Cosa fa il progetto

- libreria locale con upload multiplo e upload di cartelle
- gestione file e cartelle con persistenza su disco
- preview inline per testo, PDF, DOC e DOCX
- streaming locale con supporto HTTP range per video e audio
- QR code e link LAN per aprire libreria e player direttamente
- chat globale e chat private tra utenti della stessa rete
- stanze streaming con video condiviso, chat stanza e playback sincronizzato
- diagnostica host per bind, raggiungibilita LAN e firewall
- modalita desktop Electron con storage dedicato all'utente

## Stack

- client: React 19, React Router, Vite, Material UI, Emotion
- server: Node.js, Express, Multer, mime-types, nanoid
- document preview: Mammoth per `.docx`, WordExtractor per `.doc`
- realtime: Server-Sent Events
- desktop: Electron + electron-builder
- test: Vitest + Supertest per API, Playwright per end-to-end

## Come e organizzato

### Client

La SPA vive in `src/` ed e orchestrata da [src/App.tsx](src/App.tsx).

Rotte principali:

| Route | Pagina | Scopo |
| --- | --- | --- |
| `/` | landing | presentazione prodotto e accesso rapido |
| `/app` | libreria | upload, filtri, preview, download, QR |
| `/chat/globale` | chat LAN | canale globale |
| `/chat/utente/:userId` | chat privata | thread diretto tra due utenti |
| `/stream` | elenco stanze | crea e gestisce le stanze streaming |
| `/stream/room/:roomId` | stanza | video condiviso, sync playback, chat |
| `/player/:itemId` | player diretto | riproduzione di un contenuto specifico |
| `/settings` | impostazioni | profilo locale, diagnostica host e feature flags |

Componenti chiave:

- `src/components/PageHeader.tsx`: header globale, navigazione e accesso alle impostazioni
- `src/components/UploadSurface.tsx`: upload file e cartelle
- `src/components/FolderExplorer.tsx`: navigazione gerarchica della libreria
- `src/components/LibraryGrid.tsx`: griglia contenuti e filtri
- `src/components/MediaDetail.tsx`: preview, player, download e metadati
- `src/components/NicknameDialog.tsx`: identita locale richiesta al primo accesso

Lato client, le chiamate API stanno in [src/lib/api.ts](src/lib/api.ts), mentre [src/lib/useLanLiveState.ts](src/lib/useLanLiveState.ts) gestisce SSE e fallback.

### Server

Il server nasce da [server/app.ts](server/app.ts) ed e avviato da [server/index.ts](server/index.ts). Per default ascolta su `0.0.0.0:8787`, calcola l'IP privato del device e stampa sia URL locale sia URL LAN.

Moduli principali:

- `server/storage.ts`: persistenza libreria, cartelle, upload, delete, manifest
- `server/realtime.ts`: chat, stanze streaming, playback state, manifest realtime
- `server/archive.ts`: archivio cartelle in `zip`, `7z`, `rar` quando supportati dall'host
- `server/diagnostics.ts`: controlli di raggiungibilita LAN e suggerimenti host/firewall
- `server/network.ts`: rilevamento IP privato e URL sessione
- `server/events.ts`: hub SSE per broadcast e keepalive

### Shared

[shared/types.ts](shared/types.ts) contiene il contratto condiviso tra client e server: `LibraryItem`, `SessionInfo`, chat, stream rooms, preview e diagnostica.

[shared/playback.ts](shared/playback.ts) risolve la posizione effettiva del playback quando una stanza e in stato `playing`.

### Desktop

[desktop/main.mjs](desktop/main.mjs) avvia il server compilato dentro Electron, apre una `BrowserWindow` e salva lo storage sotto la cartella `userData` dell'app invece che nel `storage/` del repo.

## API principali

### Sessione e host

| Metodo | Path | Descrizione |
| --- | --- | --- |
| `GET` | `/api/health` | health check |
| `GET` | `/api/me` | metadati client della richiesta |
| `GET` | `/api/session` | nome app, hostname, URL LAN, storage path, conteggi |
| `GET` | `/api/diagnostics` | controlli host e suggerimenti operativi |

### Libreria

| Metodo | Path | Descrizione |
| --- | --- | --- |
| `GET` | `/api/items` | elenco completo libreria |
| `GET` | `/api/items/:id` | dettaglio item |
| `POST` | `/api/folders` | crea cartella |
| `POST` | `/api/items` | upload file o cartelle |
| `DELETE` | `/api/items/:id` | elimina file o cartella ricorsivamente |
| `GET` | `/api/items/:id/download` | download item; se cartella crea archivio temporaneo |
| `POST` | `/api/items/:id/archive` | genera un file archivio persistente dalla cartella |
| `GET` | `/api/items/:id/content` | accesso raw al contenuto |
| `GET` | `/api/items/:id/preview` | preview testo/PDF/folder o fallback |
| `GET` | `/api/items/:id/stream` | streaming audio/video con supporto `Range` |

### Chat

| Metodo | Path | Descrizione |
| --- | --- | --- |
| `GET` | `/api/chat` | snapshot chat globale e utenti noti |
| `POST` | `/api/chat/messages` | invio messaggio globale |
| `GET` | `/api/chat/users/:id` | snapshot thread privato |
| `POST` | `/api/chat/users/:id/messages` | invio messaggio privato |

### Streaming locale

| Metodo | Path | Descrizione |
| --- | --- | --- |
| `GET` | `/api/stream/rooms` | lista stanze |
| `POST` | `/api/stream/rooms` | crea stanza |
| `GET` | `/api/stream/rooms/:id` | dettaglio stanza |
| `DELETE` | `/api/stream/rooms/:id` | elimina stanza |
| `POST` | `/api/stream/rooms/:id/messages` | chat della stanza |
| `POST` | `/api/stream/rooms/:id/video` | imposta il video condiviso |
| `POST` | `/api/stream/rooms/:id/playback` | play, pause, seek sincronizzati |

### Realtime

| Metodo | Path | Descrizione |
| --- | --- | --- |
| `GET` | `/api/events` | stream SSE per aggiornamenti live |

Eventi emessi:

- `library-updated`
- `chat-global-updated`
- `chat-private-updated`
- `stream-room-created`
- `stream-room-updated`
- `stream-room-deleted`
- `stream-room-chat-updated`

## Persistenza e file sul disco

Per il runtime web standard, i dati vivono sotto `storage/`:

- `storage/index.json`: manifest della libreria
- `storage/realtime.json`: chat, thread privati, stanze e playback
- `storage/library/`: file caricati o generati

Dettagli importanti:

- gli upload usano nomi sanitizzati e prefisso ID per evitare collisioni
- se mancano file dal disco, il manifest viene ripulito all'avvio
- le cartelle archiviate vengono stage-ate in una directory temporanea e poi rimosse
- in desktop mode lo storage passa a `app.getPath("userData")/storage`

## Archivi supportati

Routy rileva i formati disponibili a runtime in [server/archive.ts](server/archive.ts):

- `zip` e `7z` passano da `bsdtar`
- `rar` richiede il comando `rar`

Se un formato non e disponibile sull'host, l'API lo segnala e la UI si adatta.

## Diagnostica LAN

La pagina diagnostica verifica:

- bind del server su `0.0.0.0`
- raggiungibilita del proprio URL LAN via `/api/health`
- su Windows: profilo rete `Private/Public`
- su Windows: presenza di regole firewall inbound

Quando serve, propone anche comandi suggeriti da eseguire sull'host.

## Avvio in sviluppo

Prerequisiti:

- Node.js recente
- npm
- opzionale: `bsdtar` e `rar` per tutti i formati archivio

Installazione:

```bash
npm install
```

Avvio sviluppo:

```bash
npm run dev
```

Questo comando avvia in parallelo:

- Vite su `http://127.0.0.1:5173`
- server Express su `http://127.0.0.1:8787`

Variabili utili:

- `PORT`: porta del server, default `8787`
- `STORAGE_ROOT`: radice custom per storage e manifest

Esempio:

```bash
PORT=8788 STORAGE_ROOT=.tmp/dev-storage npm run dev
```

## Licenza

Il codice originale e i materiali proprietari di questo repository sono
distribuiti con licenza proprietaria: vedi [LICENSE](LICENSE).

Le dipendenze, i font, le icone e gli altri componenti di terze parti
rimangono soggetti alle rispettive licenze: vedi
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Nel metadata npm il progetto e marcato come `UNLICENSED`.

## Build e runtime

Build produzione:

```bash
npm run build
```

Avvio produzione locale:

```bash
npm run start
```

Output:

- client compilato: `dist/client/`
- server compilato: `dist/server/`
- tipi shared compilati: `dist/shared/`

Il server, se trova `dist/client`, serve la SPA e fa fallback a `index.html` per tutte le rotte non `/api`.

## Desktop e packaging

Avvio desktop:

```bash
npm run desktop:start
```

Packaging:

```bash
npm run desktop:pack
npm run desktop:dist
npm run desktop:dist:win
npm run desktop:dist:mac
npm run desktop:dist:linux:x64
```

Configurazione packaging in [electron-builder.config.cjs](electron-builder.config.cjs):

- `appId`: `it.routy.desktop`
- output: `release/`
- target Windows: `nsis-web`
- target macOS: `dmg`
- target Linux: `AppImage`

Le build Windows pubblicate da CI includono il feed per `electron-updater`: il primo download avviene tramite `Web Setup.exe`, gli update successivi arrivano dentro l'app installata.

## Test e QA

Fixture generator:

```bash
npm run fixtures
```

Genera media e documenti di test in `tests/fixtures/`.

Suite disponibili:

- `npm test`: Vitest + Supertest per API e persistenza
- `npm run test:e2e`: Playwright end-to-end su browser Chromium

Copertura attuale delle suite:

- metadati sessione e URL LAN
- upload cartelle annidate e persistenza al riavvio
- preview `.txt`, `.docx`, `.pdf`
- streaming con supporto `Range`
- delete ricorsivo
- persistenza chat, stanze e playback
- UX libreria desktop/mobile
- sync SSE tra client
- chat LAN multi-client
- watch party con playback sincronizzato

Playwright usa un `STORAGE_ROOT` temporaneo sotto `.tmp/playwright-storage`.

Checklist QA manuale in [docs/qa-inventory.md](docs/qa-inventory.md).

## Struttura del repo

```text
.
├── desktop/                # bootstrap Electron
├── docs/                   # prompt imagegen e checklist QA
├── public/                 # asset statici, brand e visual
├── scripts/                # generatori fixture e script supporto
├── server/                 # API, storage, SSE, diagnostica, realtime
├── shared/                 # tipi e logica condivisa client/server
├── src/                    # SPA React
├── tests/                  # API tests, e2e e fixture
├── dist/                   # output build
└── storage/                # dati runtime locali, se non ridefiniti
```

## Asset e documentazione interna

- brand: `public/brand/`
- visual landing: `public/visuals/`
- screenshot: `public/screenshots/`
- prompt image generation: [docs/imagegen-prompts.md](docs/imagegen-prompts.md)
