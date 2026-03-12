# Third-Party Notices

Questo progetto e proprietario per quanto riguarda il codice e i materiali
originali dell'autore, ma incorpora o dipende da componenti di terze parti
soggetti a licenze separate.

Le dipendenze terze non diventano proprietarie solo perche il progetto
complessivo e proprietario. In caso di distribuzione di sorgenti, binari o
pacchetti desktop, devi continuare a rispettare le rispettive licenze,
attribuzioni e notice.

## Componenti principali rilevati

Questa lista copre le dipendenze dirette piu rilevanti individuate in
`package.json` e `package-lock.json` allo stato attuale del repository.

| Componente | Uso | Licenza | Note |
| --- | --- | --- | --- |
| `@mui/material` | Componenti UI | MIT | Libreria MUI compatibile con software proprietario mantenendo i notice richiesti. |
| `@mui/icons-material` | Icone UI in stile Material | MIT | Il pacchetto npm e MIT; eventuali marchi Google o Material restano dei rispettivi titolari. |
| `@emotion/react`, `@emotion/styled` | Styling runtime | MIT | Usati insieme a MUI. |
| `react`, `react-dom`, `react-router-dom` | Runtime client SPA | MIT | Nessun obbligo copyleft. |
| `express`, `mime-types`, `multer`, `nanoid`, `word-extractor` | Runtime server | MIT | Compatibili con distribuzione proprietaria. |
| `mammoth` | Preview `.docx` | BSD-2-Clause | Richiede il mantenimento del notice applicabile. |
| `@fontsource/titillium-web` / Titillium Web | Font UI | OFL-1.1 | Se redistribuisci i file font, conserva i notice e i termini della SIL Open Font License 1.1. |
| `electron` | Runtime desktop | MIT | Rilevante per build desktop distribuite. |

## Nota pratica su Google Material

Usare Material UI o icone/materiali compatibili non ti impedisce di rendere
proprietario il tuo codice. Quello che non puoi fare e "ri-licenziare" come
proprietari i componenti di terze parti: restano sotto le loro licenze
originarie.

In particolare:

- il tuo codice e i tuoi asset possono restare proprietari;
- le librerie MUI restano MIT;
- eventuali font restano soggetti ai rispettivi termini, ad esempio OFL-1.1;
- nomi, loghi e marchi di Google, Material, React, Electron e altri restano
  dei rispettivi titolari.

## Raccomandazione per la distribuzione

Prima di distribuire pubblicamente binari o pacchetti installer, conviene
includere anche:

- i testi di licenza completi dei componenti effettivamente redistribuiti;
- eventuali file `NOTICE` richiesti da singole dipendenze;
- un inventario aggiornato delle dipendenze transitive se il pacchetto finale
  le incorpora.
