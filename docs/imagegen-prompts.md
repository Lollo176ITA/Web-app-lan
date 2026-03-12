# Routy Imagegen Prompts

`OPENAI_API_KEY` non è disponibile in questo ambiente, quindi gli asset finali `imagegen` non sono stati generati live. I prompt sono pronti per il bundled CLI dello skill.

## Asset 1
Use case: ui-mockup
Asset type: landing page hero
Primary request: immagine hero premium per Routy che mostri una libreria media locale condivisa tra desktop, tablet e smartphone sulla stessa LAN
Scene/background: studio domestico pulito con atmosfera tech, senza elementi cloud o Internet
Subject: tre device con la stessa interfaccia Routy aperta, collegati da segnali di rete locale sottili e credibili
Style/medium: mockup prodotto illustrato, credibile e pronto per landing page SaaS
Composition/framing: widescreen hero, focus sui device al centro-sinistra con spazio negativo pulito a destra per headline e CTA
Lighting/mood: luce morbida da studio, premium, veloce, affidabile
Color palette: blu freddo, cyan, teal, grafite, bianco sporco
Quality: high
Text (verbatim): ""
Constraints: nessun logo inventato, nessuna nuvola Internet, nessun watermark, interfaccia coerente con un media relay locale
Avoid: stock-photo vibe, oversharpening, neon aggressivo, glow eccessivo, clutter, purple bias

CLI:
```bash
python3 /Users/lorenzo/.codex/skills/imagegen/scripts/image_gen.py generate \
  --model gpt-image-1.5 \
  --prompt-file docs/imagegen-prompts.md \
  --out output/imagegen/routy-landing-hero.png
```

## Asset 2
Use case: product-mockup
Asset type: feature image devices
Primary request: tre device con la stessa libreria media Routy aperta in LAN, con player locale attivo e stato host visibile
Scene/background: sfondo chiaro da scheda prodotto, senza iconografia cloud o Internet
Subject: desktop, tablet e mobile allineati con schermate coerenti e contenuti media leggibili
Style/medium: mockup prodotto pulito e credibile
Composition/framing: front-facing, leggibile, adatto a sezione proof
Lighting/mood: luce morbida da studio
Color palette: blu, teal, bianco, grafite
Quality: high
Constraints: niente testo extra, niente watermark, visual language Material Design 3
Avoid: finti riflessi eccessivi, purple bias, UI confusa
