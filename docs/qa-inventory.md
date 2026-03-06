# Routeroom QA Inventory

## Claims to Sign Off
- La landing comunica chiaramente che Routeroom funziona solo in LAN e non passa da Internet.
- La CTA principale porta all’app operativa senza ambiguità.
- Un host può caricare file multipli e salvarli in libreria persistente.
- I video si possono riprodurre nel browser via streaming locale.
- Immagini e audio hanno una preview inline.
- Un secondo client vede gli aggiornamenti libreria senza refresh.
- L’esperienza resta leggibile e controllabile a `1600x900` e `390x844`.

## Controls and States
- `Apri la LAN`: stato iniziale landing, navigazione verso `/app`.
- `Seleziona file`: apre input file e avvia upload multiplo.
- Drag-and-drop area: stato neutro, hover attivo, upload in corso.
- Filtri libreria: `Tutti`, `Video`, `Immagini`, `Audio`, `Documenti`, `Archivi`, `Altro`.
- Card libreria: stato non selezionato, selezionato, stato libreria vuota.
- Detail panel: video player, image preview, audio player, download-only.
- Session card: QR presente, copia URL, conteggi aggiornati.
- Live badge: `Connessione eventi`, `Aggiornamento live attivo`, `Fallback polling`.

## Functional Checks
- Desktop `1600x900`: landing above the fold, CTA visibile, passaggio a `/app`, upload di video+immagine+audio+documento, playback video, preview immagine, audio visibile, download documenti.
- Multi-client: due tab `/app`; upload dal primo, update libreria sul secondo via SSE.
- Persistenza: restart server con manifest esistente e libreria ricostruita.
- Off-happy-path 1: nome file duplicato caricato due volte.
- Off-happy-path 2: ID inesistente e path traversal encoded bloccati dall’API.

## Visual Checks
- Landing desktop: headline, subhead, CTA e hero image leggibili senza clipping.
- App desktop: session card, upload surface, filtri e detail panel visibili nello stato denso.
- App mobile `390x844`: titolo, upload CTA e filtri primari leggibili senza overflow.
- Controllo negativo: nessun overflow orizzontale, testo tagliato, CTA nascosta, contrasto debole nelle superfici principali.
