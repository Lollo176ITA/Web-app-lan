# Routeroom Imagegen Prompts

`OPENAI_API_KEY` non è disponibile in questo ambiente, quindi gli asset finali `imagegen` non sono stati generati live. I prompt sono pronti per il bundled CLI dello skill.

## Asset 1
Use case: stylized-concept
Asset type: landing page hero
Primary request: scena domestica/tech dove un router locale connette laptop, tablet e smartphone con Routeroom aperto
Scene/background: scrivania moderna e soggiorno pulito, senza elementi cloud o Internet
Subject: tre device che condividono file e video nella stessa LAN
Style/medium: illustrazione premium semi-realistica da product landing
Composition/framing: wide hero, focus sui device a sinistra e spazio negativo a destra per headline
Lighting/mood: luce morbida, tech pulita, fiducia e velocità
Color palette: blu freddo, teal, superfici chiare
Quality: high
Text (verbatim): ""
Constraints: nessun logo inventato, nessuna nuvola Internet, nessun watermark
Avoid: stock-photo vibe, oversharpening, neon aggressivo, clutter

CLI:
```bash
python /Users/lorenzo/.codex/skills/imagegen/scripts/image_gen.py generate \
  --model gpt-image-1.5 \
  --prompt-file docs/imagegen-prompts.md \
  --out output/imagegen/routeroom-hero.png
```

## Asset 2
Use case: product-mockup
Asset type: feature image devices
Primary request: tre device con la stessa libreria media Routeroom aperta in LAN
Scene/background: sfondo chiaro da scheda prodotto, senza internet iconography
Subject: desktop, tablet e mobile allineati con schermate coerenti
Style/medium: mockup prodotto pulito e credibile
Composition/framing: front-facing, leggibile, adatto a sezione proof
Lighting/mood: luce morbida da studio
Color palette: blu, teal, bianco, grafite
Quality: high
Constraints: niente testo extra, niente watermark, visual language Material Design 3
Avoid: finti riflessi eccessivi, purple bias, UI confusa
