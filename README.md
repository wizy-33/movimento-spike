# movimento-spike

Pagina di prova usa e getta per decidere il motore musicale (A: Spotify, B: audio in-app).
Vedi `brief-test-tecnico.md`.

## Sviluppo locale

```sh
npm install
npm run dev      # http://127.0.0.1:5173/  (non localhost: Spotify non lo accetta)
npm run check    # type-check TypeScript
```

Dal telefono `127.0.0.1` non è raggiungibile: i test su iPhone si fanno sulla versione pubblicata.

## Deploy

1. GitHub → repo → Settings → Pages → Source: **GitHub Actions** (una volta sola).
2. Ogni push su `main` esegue `.github/workflows/deploy.yml` e pubblica su
   https://wizy-33.github.io/movimento-spike/ (circa 1 minuto; stato in Actions).

## Dashboard Spotify

https://developer.spotify.com/dashboard → app → Settings:

- Redirect URIs, identici carattere per carattere (con la `/` finale):
  - `https://wizy-33.github.io/movimento-spike/`
  - `http://127.0.0.1:5173/`
- APIs used: **Web API**.
- User Management: aggiungi nome ed email dell'account Spotify che farà il login
  (Development Mode, massimo 5 utenti). Serve un account Premium.

## iPhone

1. Apri https://wizy-33.github.io/movimento-spike/ in **Safari** → Condividi → **Aggiungi alla schermata Home**
   (attiva "Apri come app web" se compare).
2. Apri l'app dalla Home e fai il login da lì: il token salvato in Safari non è visibile alla PWA e viceversa.
3. Nell'app Spotify: Impostazioni → Riproduzione → valuta di lasciare **Autoplay** attivo per il primo giro,
   così il log mostra se Spotify fa partire altri brani a fine traccia.

### Debug dal Mac (consigliato)

iPhone: Impostazioni → App → Safari → Avanzate → **Web Inspector** attivo.
Mac: collega il cavo, Safari → menu Sviluppo → nome dell'iPhone → scegli la pagina (anche la PWA installata).
Hai console, rete e storage in tempo reale.

## Come usare la pagina

- **Sessione di prova**: scegli il motore, incolla due brani (Spotify → Condividi → Copia link, oppure `spotify:track:<id>`)
  oppure carica due file nel Test 5. "Inizia" mostra la spiegazione dell'esercizio, "Sono pronta" fa partire il brano,
  gli indizi compaiono da soli, a fine brano si passa alla spiegazione successiva, poi il riepilogo.
  Gli indizi sono in `SESSION` in `src/main.ts`. "Segna" logga la posizione corrente: serve per scrivere i timestamp veri.
- **Esiti**: scegli lo scenario, tocca l'esito (eventuale nota prima). "Copia tabella risultati" produce la tabella in Markdown.
- **Copia log**: il log resta salvato anche dopo il ricaricamento (il login ricarica la pagina).

## Cosa è emerso finora (iPhone, iOS 18.7)

- Login PKCE dall'app installata: funziona (il redirect torna nella PWA, verifier trovato).
- `PUT /me/player/play` con `uris` risponde 204 ma **ferma** Spotify, anche con brani `is_playable=true`
  e anche con il brano già in riproduzione. Il 204 vuol dire solo "comando inoltrato".
- Funzionano: pausa, riprendi, seek, `context_uri` (album) + `offset`, coda + `next`.
  La pagina ora avvia i brani con album + offset (riserva: coda + avanti).
- Spotify **in pausa** in background smette di rispondere dopo un tempo da misurare (Test pause automatico).
- Al ritorno in primo piano le prime richieste possono restare appese ~12 s e riprovare non le sblocca (timeout portato a 15 s).
- Con Spotify in **modalità offline** l'iPhone non compare fra i dispositivi: il motore A richiede Spotify online
  (i brani scaricati vanno bene, basta non attivare l'interruttore offline). Il motore B funziona anche senza rete.
