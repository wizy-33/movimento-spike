# Brief per Claude Code – Test tecnico preliminare (spike)

## Contesto del progetto
Stiamo progettando un'app per aiutare una ragazza a fare movimento con costanza. È mediamente sportiva ma si annoia in fretta; ama la musica, cantare, la primavera, nuotare e camminare con la sua cagnolina. Il nuoto (una volta a settimana) è l'unica attività che non la stufa.

L'idea centrale: **allenamenti a corpo libero guidati dalla musica**, con esercizi legati alla struttura delle canzoni ("al ritornello fai 10 squat", "ogni volta che dice quella parola fai un salto"). Obiettivo fisico: gambe e glutei. Obiettivo vero: divertirsi abbastanza da continuare. Sessioni da 30–45 minuti, playlist di 7–10 brani (cantautori italiani, Battisti, Fulminacci, Alfa, reggaeton) che alternano brani intensi e leggeri.

**Requisito principale dell'app finale: semplicità d'uso e massima automazione.** Lei deve premere un solo pulsante ("Inizia l'allenamento di oggi") e l'app deve fare tutto: far partire la musica, mostrare e annunciare gli esercizi al momento giusto, passare al brano successivo, chiudere con un riepilogo. Ogni passaggio manuale in più è un motivo per mollare.

Chi sviluppa (il committente) è un ingegnere informatico esperto in Python, a suo agio con iOS nativo, meno con le tecnologie web. Spiega le scelte non ovvie in modo conciso.

## Decisioni già prese (non rimetterle in discussione senza motivo)
- **PWA** su GitHub Pages, installata nella Home dell'iPhone. Scartata l'app nativa per ora: richiede 99 €/anno o reinstallazione ogni 7 giorni. Ci torneremo solo se questo test mostra limiti seri.
- **Timestamp degli esercizi curati a mano** canzone per canzone. Il riconoscimento automatico di ritornelli o parole non è affidabile, e Spotify ha rimosso l'analisi audio per le app nuove.
- **Niente download da YouTube** e **nessun file audio caricato su server**: i brani si ascoltano tramite Spotify o da file legittimi che restano sul telefono.
- **Spotify Development Mode**: il Client ID esiste già (riusato da un'altra app dello stesso sviluppatore), massimo 5 utenti autorizzati, Premium necessario per comandare la riproduzione.
- App finale (non questo spike): React + TypeScript + Vite, Tailwind, Dexie su IndexedDB, dati local-first predisposti per una futura sincronizzazione Supabase.

## Perché questo test
Il dubbio da sciogliere è il **motore musicale**. Con Spotify la PWA non suona la musica: comanda l'app Spotify, che deve essere attiva. Temiamo tre attriti che romperebbero la semplicità:
1. errore "nessun dispositivo attivo" se iOS ha sospeso Spotify;
2. voce o suoni della pagina che interrompono la musica di Spotify invece di sovrapporsi;
3. schermo che si spegne durante la sessione.

L'alternativa è l'audio riprodotto dalla PWA stessa: più autonoma e precisa, ma con un catalogo limitato ai brani acquistati. Il test serve a decidere con dati reali, non con ipotesi.

## Come lavorare
- Codice usa e getta: niente astrazioni, niente framework, niente test automatici. Conta che i risultati siano osservabili e loggati.
- Se un'API si comporta diversamente da quanto previsto qui, **registralo nel log e segnalalo**, non aggirarlo in silenzio: è esattamente l'informazione che cerchiamo.
- Prima di scelte che cambiano lo scopo del test (nuove dipendenze, backend, librerie Spotify di terzi), chiedi.
- A fine lavoro: istruzioni brevi per il deploy, la configurazione della dashboard Spotify e l'installazione sull'iPhone.

## Obiettivo
Costruire una **pagina di prova usa e getta** per verificare su iPhone (iOS aggiornato, iPhone 14) se una PWA può guidare un allenamento sincronizzato con la musica in modo affidabile e "quasi automatico".
Il codice di questo spike NON verrà riusato: priorità a semplicità e log chiari, non all'architettura.

Al termine dobbiamo poter decidere tra due motori musicali:
- **A. Spotify** comandato tramite Web API (l'app Spotify suona, la PWA guida)
- **B. Audio in-app** (file audio locale riprodotto dalla PWA stessa)

## Vincoli tecnici
- Vite + TypeScript, senza framework (vanilla), un'unica pagina.
- Deploy su **GitHub Pages** tramite GitHub Actions (serve HTTPS: richiesto da Spotify e per installare la PWA).
- Manifest minimo per "Aggiungi alla schermata Home" (nome, icona semplice, `display: standalone`).
- Login Spotify con **Authorization Code + PKCE**, nessun server, nessun client secret. Il Client ID è pubblico e può stare nel codice.
- Redirect URI da registrare nella dashboard Spotify:
  - produzione: `https://<utente>.github.io/<repo>/`
  - sviluppo: `http://127.0.0.1:5173/` (Spotify non accetta `localhost`)
- Scope Spotify: `user-read-playback-state`, `user-modify-playback-state`.
- Uso esclusivo da smartphone: pulsanti grandi, testo leggibile.

## Pannello di log (obbligatorio)
Ogni evento rilevante va mostrato in un pannello a fondo pagina con orario (ms): chiamate API, codici HTTP, errori (es. `NO_ACTIVE_DEVICE`), stato wake lock, eventi audio.
Pulsante **"Copia log"** per incollare i risultati.

## Test da implementare

### Test 1 – Controllo Spotify
1. Login PKCE e salvataggio token (con refresh automatico).
2. Elenco dispositivi (`GET /me/player/devices`) e selezione dell'iPhone.
3. Avvio di un brano specifico tramite URI (campo di testo, es. `spotify:track:...`) sul dispositivo scelto.
4. Polling di `GET /me/player` ogni secondo: mostra titolo, posizione e durata; interpola la posizione tra un polling e l'altro.
5. Pulsanti pausa / riprendi / salta a un secondo.
6. Pulsante **"Apri Spotify"** (deep link `spotify:`) per riattivare l'app quando non c'è un dispositivo attivo.

Scenari da provare (annotare l'esito nel log):
- Spotify appena aperto e messo in background.
- Spotify in background da 10+ minuti.
- Spotify chiuso forzatamente.

### Test 2 – Voce e suoni sopra la musica
Due pulsanti: **"Parla"** (`speechSynthesis`, frase "Ora squat!") e **"Bip"** (breve suono via Web Audio).
Da provare sia con Spotify in riproduzione sia con l'audio in-app (Test 5), anche con l'interruttore silenzioso attivo.
Esiti possibili da registrare: musica continua / si abbassa / si interrompe / nessun suono.

### Test 3 – Schermo sempre acceso
Pulsante che richiede il **Screen Wake Lock**; mostra lo stato e lo riacquisisce quando la pagina torna visibile.
Verificare con l'app installata nella Home: lo schermo resta acceso per 5 minuti senza toccarlo?

### Test 4 – Esercizi sincronizzati
Lista di indizi scritta a mano nel codice per un brano di prova, ad esempio:
`[{ t: 45, label: "Ritornello → 10 squat" }, { t: 72, label: "Salto!" }]`
- Mostra in grande l'esercizio corrente e un preavviso "tra 5 secondi → …".
- Verificare la sincronia percepita, anche dopo pausa e salto avanti/indietro.
- Funziona sia con il motore A (posizione da Spotify) sia con il motore B (posizione da `audio.currentTime`).

### Test 5 – Motore alternativo: audio in-app
- Selettore file (`<input type="file" accept="audio/*">`) che apre l'app File di iOS.
- Riproduzione con elemento `<audio>`, stessi indizi del Test 4.
- Durante la voce del Test 2, abbassare il volume della musica e ripristinarlo dopo.
- Usare un brano di prova legittimo (acquistato o senza copyright). Il file resta sul telefono, non viene caricato da nessuna parte.

## Tabella dei risultati (da compilare sul telefono)

| Test | Esito | Note |
| --- | --- | --- |
| 1. Spotify appena aperto | | |
| 1. Spotify in background 10+ min | | |
| 1. Spotify chiuso | | |
| 2. Voce sopra Spotify | | |
| 2. Voce sopra audio in-app | | |
| 3. Schermo acceso 5 min (app installata) | | |
| 4. Sincronia con Spotify | | |
| 4. Sincronia con audio in-app | | |

## Criteri di decisione
- **Si tiene Spotify** se: il brano parte in modo affidabile almeno nei primi due scenari (o con un solo tocco su "Apri Spotify"), la voce non interrompe la musica, la sincronia è buona.
- **Si passa all'audio in-app** se Spotify richiede passaggi manuali frequenti o la voce lo interrompe.
- In entrambi i casi il wake lock deve funzionare con l'app installata.

## Note pratiche
- Per il Test 1 serve un account **Premium** sul telefono di prova: si può usare temporaneamente l'account dello sviluppatore, perché il comportamento di iOS è lo stesso.
- Ricordarsi di aggiungere l'account usato alla lista utenti autorizzati nella dashboard Spotify (Development Mode, massimo 5 utenti).
