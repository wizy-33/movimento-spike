// Spike usa e getta: un unico file, niente astrazioni. Conta solo che ogni evento finisca nel log.
import './style.css';

// ---------------------------------------------------------------- config

const CLIENT_ID = '41714cc9bc184eec8706080e462b7371';
const SCOPES = 'user-read-playback-state user-modify-playback-state';
// Deve coincidere carattere per carattere con un redirect URI registrato nella dashboard.
const REDIRECT_URI = location.origin + import.meta.env.BASE_URL;
const API = 'https://api.spotify.com/v1';

type Cue = { t: number; label: string };
type Track = { exercise: string; explain: string; cues: Cue[] };

// Indizi scritti a mano. Il tempo è anche nell'etichetta, così la sincronia
// si può giudicare a occhio rispetto al timer anche senza conoscere il brano.
const SESSION: Track[] = [
  {
    exercise: 'Squat',
    explain:
      'Piedi alla larghezza delle spalle, punte leggermente in fuori.\n' +
      'Scendi come per sederti, schiena dritta, peso sui talloni.\n' +
      'Quando compare la scritta, fai le ripetizioni indicate.',
    cues: [
      { t: 10, label: '0:10 → Riscaldamento: marcia sul posto' },
      { t: 25, label: '0:25 → 10 squat' },
      { t: 45, label: '0:45 → Pausa, respira' },
      { t: 60, label: '1:00 → 10 squat lenti' },
      { t: 80, label: '1:20 → Salto!' },
      { t: 85, label: '1:25 → Pausa' },
      { t: 100, label: '1:40 → 15 squat' },
      { t: 125, label: '2:05 → Salto!' },
      { t: 130, label: '2:10 → Marcia sul posto' },
      { t: 160, label: '2:40 → 10 squat' },
      { t: 190, label: '3:10 → Defaticamento' },
    ],
  },
  {
    exercise: 'Affondi',
    explain:
      'Fai un passo lungo in avanti e scendi finché entrambe le ginocchia sono a 90°.\n' +
      'Torna su spingendo col piede davanti, poi cambia gamba.',
    cues: [
      { t: 10, label: '0:10 → Ponte glutei: 10 volte' },
      { t: 30, label: '0:30 → 8 affondi per gamba' },
      { t: 55, label: '0:55 → Pausa' },
      { t: 70, label: '1:10 → Salto!' },
      { t: 75, label: '1:15 → 8 affondi per gamba' },
      { t: 105, label: '1:45 → Pausa' },
      { t: 120, label: '2:00 → Ponte glutei: 15 volte' },
      { t: 150, label: '2:30 → Salto!' },
      { t: 155, label: '2:35 → Stretching' },
    ],
  },
];

const SCENARIOS = [
  "Login dall'app installata",
  '1. Spotify appena aperto',
  '1. Spotify in background 10+ min',
  '1. Spotify chiuso',
  '2. Voce sopra Spotify',
  '2. Voce sopra audio in-app',
  '2. Bip/clip sopra Spotify',
  '2. Bip/clip sopra audio in-app',
  '2. Con interruttore silenzioso',
  '3. Schermo acceso 5 min (app installata)',
  '4. Sincronia con Spotify',
  '4. Sincronia con audio in-app',
  '6. Passaggio al brano successivo (Spotify)',
  '6. Passaggio al brano successivo (audio in-app)',
  'Schermo bloccato durante la sessione',
  'Persistenza file dopo riavvio',
  'Cuffie/cassa Bluetooth',
  'Sessione lunga 30–45 min',
  'Interruzioni (notifica, chiamata)',
];
const OUTCOMES = ['OK', 'Problema', 'Musica continua', 'Musica si abbassa', 'Musica si interrompe', 'Nessun suono'];

// ---------------------------------------------------------------- utilità

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage', e);
  }
}

function fmt(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}

function isStandalone() {
  return (navigator as any).standalone === true || matchMedia('(display-mode: standalone)').matches;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

// ---------------------------------------------------------------- log

type Level = 'info' | 'ok' | 'warn' | 'err' | 'note';
type LogLine = { text: string; level: Level };

// Il log sopravvive ai ricaricamenti: il login fa un giro su accounts.spotify.com e ricarica la pagina.
const logLines = load<LogLine[]>('spike.log', []);
const logEl = $('log');

function stamp() {
  const d = new Date();
  return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function renderLogLine(l: LogLine) {
  const div = document.createElement('div');
  div.className = l.level;
  div.textContent = l.text;
  logEl.prepend(div);
}

function log(msg: string, level: Level = 'info') {
  const line = { text: `${stamp()} ${msg}`, level };
  logLines.push(line);
  if (logLines.length > 3000) logLines.splice(0, logLines.length - 3000);
  save('spike.log', logLines);
  renderLogLine(line);
  console.log(line.text);
}

logLines.forEach(renderLogLine);

$('copyLog').onclick = async () => {
  const ok = await copyText(logLines.map((l) => l.text).join('\n'));
  log(ok ? `Log copiato (${logLines.length} righe)` : 'Copia log non riuscita', ok ? 'ok' : 'err');
};
$('clearLog').onclick = () => {
  if (!confirm('Cancellare il log?')) return;
  logLines.length = 0;
  save('spike.log', logLines);
  logEl.textContent = '';
};

// ---------------------------------------------------------------- ambiente e ciclo di vita

const audioSessionApi = (navigator as any).audioSession as { type: string; state?: string; onstatechange?: () => void } | undefined;

function logEnvironment() {
  const info = [
    isStandalone() ? 'app installata (standalone)' : 'browser',
    `wakeLock ${'wakeLock' in navigator ? 'sì' : 'no'}`,
    `audioSession ${audioSessionApi ? 'sì' : 'no'}`,
    `speechSynthesis ${'speechSynthesis' in window ? 'sì' : 'no'}`,
  ].join(' · ');
  $('env').textContent = info;
  log(`AVVIO ${info}`, 'note');
  log(`UA ${navigator.userAgent}`);
  log(`Redirect URI ${REDIRECT_URI}`);
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    log('PAGINA nascosta');
  } else {
    log(`PAGINA di nuovo visibile (nascosta per ${((Date.now() - hiddenAt) / 1000).toFixed(1)} s)`);
    onVisible();
  }
});
window.addEventListener('pagehide', () => log('EVENTO pagehide'));
window.addEventListener('pageshow', (e) => log(`EVENTO pageshow persisted=${(e as PageTransitionEvent).persisted}`));
document.addEventListener('freeze', () => log('EVENTO freeze'));
document.addEventListener('resume', () => log('EVENTO resume'));

// Se iOS sospende il JavaScript (schermo bloccato, app in background) i timer si fermano:
// lo si vede come un buco tra un battito e l'altro.
let lastBeat = Date.now();
let suspensions = 0;
setInterval(() => {
  const now = Date.now();
  const gap = now - lastBeat;
  if (gap > 3000) {
    suspensions++;
    log(`JS sospeso per ${(gap / 1000).toFixed(1)} s (timer fermi)`, 'warn');
  }
  lastBeat = now;
}, 1000);

async function onVisible() {
  if (wlWanted && !wakeLock) {
    log('WAKELOCK riacquisizione dopo il ritorno in primo piano');
    await requestWakeLock();
  }
  if (token) {
    await getDevices();
    await retryPendingPlay();
    if (pollingOn) poll();
  }
}

// ---------------------------------------------------------------- Spotify: login PKCE e token

type Token = { access: string; refresh: string; expiresAt: number };
let token = load<Token | null>('spike.token', null);
let refreshing: Promise<boolean> | null = null;

function b64url(bytes: Uint8Array) {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randomString(nBytes: number) {
  const a = new Uint8Array(nBytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

async function login() {
  const verifier = randomString(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const state = randomString(16);
  save('spike.pkce', { verifier, state, at: Date.now(), standalone: isStandalone() });
  log(`LOGIN avvio da ${isStandalone() ? 'app installata' : 'browser'}, redirect ${REDIRECT_URI}`);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: b64url(new Uint8Array(digest)),
    scope: SCOPES,
    state,
  });
  location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function handleRedirect() {
  const q = new URLSearchParams(location.search);
  const code = q.get('code');
  const error = q.get('error');
  if (!code && !error) return;
  history.replaceState(null, '', location.pathname);

  const pkce = load<{ verifier: string; state: string; at: number; standalone: boolean } | null>('spike.pkce', null);
  log(
    `LOGIN ritorno dal redirect in ${isStandalone() ? 'app installata' : 'browser'}; verifier ${pkce ? 'trovato' : 'NON trovato'}`,
    pkce ? 'info' : 'err',
  );
  if (error) return log(`LOGIN rifiutato da Spotify: ${error}`, 'err');
  if (!pkce) {
    return log(
      'LOGIN impossibile: il redirect è tornato in un contesto con storage diverso da quello che ha avviato il login (es. Safari invece della PWA)',
      'err',
    );
  }
  log(`LOGIN era partito da ${pkce.standalone ? 'app installata' : 'browser'} ${((Date.now() - pkce.at) / 1000).toFixed(0)} s fa`);
  if (q.get('state') !== pkce.state) return log('LOGIN state non corrisponde, scarto il codice', 'err');
  localStorage.removeItem('spike.pkce');
  await tokenRequest({ grant_type: 'authorization_code', code: code!, redirect_uri: REDIRECT_URI, code_verifier: pkce.verifier });
}

async function tokenRequest(params: Record<string, string>): Promise<boolean> {
  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
    });
  } catch (e) {
    log(`TOKEN ${params.grant_type} errore di rete: ${e}`, 'err');
    return false;
  }
  const ms = Math.round(performance.now() - t0);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    log(`TOKEN ${params.grant_type} → HTTP ${res.status} ${data.error ?? ''} ${data.error_description ?? ''} (${ms} ms)`, 'err');
    if (params.grant_type === 'refresh_token' && res.status === 400) {
      token = null;
      save('spike.token', null);
      log('TOKEN refresh non valido: serve un nuovo login', 'err');
    }
    return false;
  }
  const rotated = !!data.refresh_token && data.refresh_token !== token?.refresh;
  token = {
    access: data.access_token,
    refresh: data.refresh_token ?? token?.refresh ?? '',
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  save('spike.token', token);
  log(
    `TOKEN ${params.grant_type} → 200, scade tra ${Math.round(data.expires_in / 60)} min, refresh token ${rotated ? 'nuovo' : 'invariato'}, scope "${data.scope}" (${ms} ms)`,
    'ok',
  );
  return true;
}

function refreshToken() {
  if (!token?.refresh) return Promise.resolve(false);
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: token.refresh }).finally(() => (refreshing = null));
  return refreshing;
}

async function accessToken() {
  if (!token) return null;
  if (token.expiresAt - Date.now() < 60_000) {
    log('TOKEN in scadenza, refresh automatico');
    if (!(await refreshToken())) return null;
  }
  return token?.access ?? null;
}

// ---------------------------------------------------------------- Spotify: Web API

type ApiResult = { status: number; data: any; reason?: string };
let rateLimitUntil = 0;

const API_TIMEOUT_MS = 5000;

async function api(
  method: string,
  path: string,
  body?: unknown,
  opts: { quiet?: boolean; retried?: boolean; timedOut?: boolean } = {},
): Promise<ApiResult> {
  if (Date.now() < rateLimitUntil) {
    if (!opts.quiet) log(`${method} ${path} saltata: rate limit attivo`, 'warn');
    return { status: 429, data: null };
  }
  const access = await accessToken();
  if (!access) {
    log(`${method} ${path}: nessun token, fai il login`, 'warn');
    return { status: 0, data: null };
  }
  const t0 = performance.now();
  // Dopo il ritorno dal background alcune richieste restavano appese ~12 s. Le interrompo
  // dopo 5 s e riprovo una volta: se il secondo tentativo è rapido, il colpevole è la
  // connessione rimasta "morta" durante la sospensione, non Spotify.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), API_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${access}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: abort.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (abort.signal.aborted && !opts.timedOut) {
      log(`${method} ${path} → TIMEOUT dopo ${API_TIMEOUT_MS / 1000} s, riprovo una volta`, 'warn');
      return api(method, path, body, { ...opts, timedOut: true });
    }
    log(`${method} ${path} → ${abort.signal.aborted ? 'TIMEOUT anche al secondo tentativo' : `errore di rete: ${e}`}`, 'err');
    return { status: 0, data: null };
  }
  clearTimeout(timer);
  const ms = Math.round(performance.now() - t0);
  if (opts.timedOut) log(`${method} ${path} secondo tentativo dopo timeout: ${ms} ms`, 'warn');
  else if (ms > 2000) log(`${method} ${path} LENTA: ${ms} ms`, 'warn');
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (res.status === 401 && !opts.retried) {
    log(`${method} ${path} → 401, provo il refresh del token`, 'warn');
    if (await refreshToken()) return api(method, path, body, { ...opts, retried: true });
  }
  if (res.status === 429) {
    const header = res.headers.get('Retry-After');
    const wait = Number(header ?? '5');
    rateLimitUntil = Date.now() + wait * 1000;
    log(`429 RATE LIMIT su ${path}: Retry-After ${header ?? 'assente (header non leggibile o non inviato), attendo 5'} s`, 'err');
  }

  const reason: string | undefined = data?.error?.reason;
  const message: string | undefined = data?.error?.message;
  if (!res.ok || !opts.quiet) {
    log(`${method} ${path} → ${res.status}${reason ? ` ${reason}` : ''}${message ? ` "${message}"` : ''} (${ms} ms)`, res.ok ? 'ok' : 'err');
  }
  return { status: res.status, data, reason };
}

// ---------------------------------------------------------------- Spotify: dispositivi e riproduzione

type Device = { id: string; name: string; type: string; is_active: boolean; is_restricted: boolean; volume_percent: number | null };
let devices: Device[] = [];
let selectedDevice = load<{ id: string; name: string } | null>('spike.device', null);

async function getDevices() {
  const r = await api('GET', '/me/player/devices');
  if (r.status !== 200) return;
  devices = r.data.devices ?? [];
  log(
    `DISPOSITIVI ${devices.length ? devices.map((d) => `${d.name} [${d.type}${d.is_active ? ', attivo' : ''}${d.is_restricted ? ', limitato' : ''}]`).join(', ') : 'nessuno'}`,
    devices.length ? 'info' : 'warn',
  );
  if (selectedDevice && !devices.some((d) => d.id === selectedDevice!.id)) {
    const sameName = devices.find((d) => d.name === selectedDevice!.name);
    if (sameName) {
      log(`DISPOSITIVO "${sameName.name}" ha cambiato ID: aggiorno la selezione`, 'warn');
      selectDevice(sameName);
    } else {
      log(`DISPOSITIVO scelto "${selectedDevice.name}" non è in elenco`, 'warn');
    }
  }
  renderDevices();
}

function selectDevice(d: Device) {
  selectedDevice = { id: d.id, name: d.name };
  save('spike.device', selectedDevice);
  renderDevices();
}

function renderDevices() {
  const box = $('spDevices');
  box.textContent = '';
  for (const d of devices) {
    const b = document.createElement('button');
    b.textContent = `${d.name} · ${d.type}${d.is_active ? ' · attivo' : ''}`;
    if (d.id === selectedDevice?.id) b.classList.add('selected');
    b.onclick = () => {
      selectDevice(d);
      log(`DISPOSITIVO scelto: ${d.name}`);
    };
    box.appendChild(b);
  }
}

// Se il play fallisce perché Spotify dorme, lo ricordo e lo riprovo da solo quando
// la pagina torna visibile dopo "Apri Spotify": misura il "basta un tocco".
let pendingPlay: { uri: string; at: number; forSession: boolean } | null = null;
let sessionUri = '';

// Accetta anche il link di "Condividi": https://open.spotify.com/intl-it/track/<id>?si=...
function normalizeUri(input: string) {
  const link = input.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]+)/);
  return link ? `spotify:track:${link[1]}` : input.trim();
}

async function playUri(input: string, forSession = false): Promise<boolean> {
  const uri = normalizeUri(input);
  if (!uri.startsWith('spotify:')) {
    log(`URI non valido: "${uri}"`, 'err');
    return false;
  }
  if (forSession) sessionUri = uri;
  const qs = selectedDevice ? `?device_id=${encodeURIComponent(selectedDevice.id)}` : '';
  log(`PLAY ${uri} su ${selectedDevice?.name ?? 'dispositivo attivo (nessuno scelto)'}`);
  const r = await api('PUT', `/me/player/play${qs}`, { uris: [uri], position_ms: 0 });
  if (r.status === 204 || r.status === 202 || r.status === 200) {
    pendingPlay = null;
    commandAt = performance.now();
    // 204 vuol dire solo "comando inoltrato": se il brano suona davvero lo dice il polling.
    playCheck = { uri, at: performance.now(), forSession };
    sp = { ...sp, has: true, uri, basePos: 0, baseAt: performance.now(), playing: true };
    startPolling();
    return true;
  }
  pendingPlay = { uri, at: Date.now(), forSession };
  if (r.status === 404) {
    log(`PLAY fallito (${r.reason ?? r.data?.error?.message ?? '404'}): tocca "Apri Spotify", al ritorno riprovo da solo`, 'err');
  }
  return false;
}

let playCheck: { uri: string; at: number; forSession: boolean } | null = null;

function checkPlayConfirmed() {
  if (!playCheck) return;
  const elapsed = Math.round(performance.now() - playCheck.at);
  if (sp.has && sp.uri === playCheck.uri && sp.playing) {
    log(`PLAY confermato dal polling dopo ${elapsed} ms`, 'ok');
    playCheck = null;
  } else if (elapsed > 5000) {
    log(
      `PLAY ha risposto 204 ma dopo ${elapsed} ms Spotify NON suona il brano (riporta: ${sp.has ? `"${sp.name || 'nessun brano'}", ${sp.playing ? 'in riproduzione' : 'in pausa'}` : 'nessuna riproduzione'})`,
      'err',
    );
    pendingPlay = { uri: playCheck.uri, at: Date.now(), forSession: playCheck.forSession };
    if (playCheck.forSession && ses.state === 'playing') {
      log('SESSIONE il brano non è partito: torno alla spiegazione', 'warn');
      showExplain();
    }
    playCheck = null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitPlaying(timeoutMs: number) {
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    await sleep(500);
    if (sp.has && sp.playing && performance.now() - commandAt > 1000) return Math.round(performance.now() - t0);
  }
  return -1;
}

// Quanto può restare in pausa Spotify in background prima di non rispondere più?
// Nel flusso "Sono pronta" fra un brano e l'altro la musica è ferma: questo è il numero che conta.
const PAUSE_STEPS = [10, 30, 60, 120, 300];
let ladderRunning = false;

async function pauseLadder() {
  if (ladderRunning) {
    ladderRunning = false;
    return log('TEST PAUSE interrotto a mano', 'warn');
  }
  if (!(sp.has && sp.playing)) return log('TEST PAUSE: fai prima suonare un brano su Spotify', 'warn');
  ladderRunning = true;
  $('spLadder').textContent = 'Interrompi test pause';
  startPolling();
  if (!wlWanted) await setWakeLock(true);
  log(`TEST PAUSE inizio: pause di ${PAUSE_STEPS.join(', ')} s, tieni Spike aperta e non toccare Spotify`, 'note');
  for (const s of PAUSE_STEPS) {
    if (!ladderRunning) break;
    await spPause();
    log(`TEST PAUSE in pausa per ${s} s…`);
    const end = Date.now() + s * 1000;
    while (ladderRunning && Date.now() < end) await sleep(500);
    if (!ladderRunning) break;
    await getDevices();
    await spResume();
    const ms = await waitPlaying(6000);
    if (ms >= 0) {
      log(`TEST PAUSE ${s} s: Spotify ripartito (conferma in ${ms} ms)`, 'ok');
      await sleep(5000);
    } else {
      log(`TEST PAUSE ${s} s: Spotify NON riparte dopo questa pausa`, 'err');
      break;
    }
  }
  if (ladderRunning) log('TEST PAUSE fine', 'note');
  ladderRunning = false;
  $('spLadder').textContent = 'Test pause automatico';
}

async function spTransfer() {
  if (!selectedDevice) return log('TRASFERISCI: scegli prima un dispositivo', 'warn');
  log(`TRASFERISCI riproduzione su ${selectedDevice.name} (play: true)`);
  const r = await api('PUT', '/me/player', { device_ids: [selectedDevice.id], play: true });
  if (r.status < 300) startPolling();
}

async function retryPendingPlay() {
  if (!pendingPlay) return;
  if (Date.now() - pendingPlay.at > 5 * 60_000) {
    log('PLAY in sospeso scaduto (più di 5 min), non lo riprovo');
    pendingPlay = null;
    return;
  }
  const { uri, forSession } = pendingPlay;
  pendingPlay = null;
  log('PLAY riprovo automaticamente dopo il ritorno in primo piano');
  const ok = await playUri(uri, forSession);
  log(ok ? 'PLAY automatico riuscito dopo "Apri Spotify"' : 'PLAY automatico fallito anche dopo il ritorno', ok ? 'ok' : 'err');
  if (ok && forSession) sessionTrackStarted();
}

async function spPause() {
  const r = await api('PUT', '/me/player/pause');
  if (r.status < 300) {
    sp.basePos = spPos();
    sp.baseAt = performance.now();
    sp.playing = false;
    commandAt = performance.now();
  }
}
async function spResume() {
  const r = await api('PUT', '/me/player/play');
  if (r.status < 300) {
    sp.baseAt = performance.now();
    sp.playing = true;
    commandAt = performance.now();
  }
}
async function spSeek(ms: number) {
  const r = await api('PUT', `/me/player/seek?position_ms=${Math.max(0, Math.round(ms))}`);
  if (r.status < 300) {
    sp.basePos = Math.max(0, ms);
    sp.baseAt = performance.now();
    commandAt = performance.now();
  }
}

// ---------------------------------------------------------------- Spotify: polling e interpolazione

let sp = { has: false, uri: '', name: '', artist: '', durationMs: 0, basePos: 0, baseAt: 0, playing: false, device: '' };
let pollingOn = false;
let pollTimer = 0;
let pollInFlight = false;
let commandAt = 0;
const driftSamples: number[] = [];

function spPos() {
  if (!sp.has) return 0;
  const pos = sp.playing ? sp.basePos + (performance.now() - sp.baseAt) : sp.basePos;
  return sp.durationMs ? Math.min(pos, sp.durationMs) : pos;
}

function startPolling() {
  if (pollingOn) return;
  pollingOn = true;
  pollTimer = window.setInterval(poll, 1000);
  $('spPollToggle').textContent = 'Polling: ON';
  log('POLLING avviato (1 s)');
}
function stopPolling() {
  pollingOn = false;
  clearInterval(pollTimer);
  $('spPollToggle').textContent = 'Polling: OFF';
  log('POLLING fermato');
}

async function poll() {
  if (pollInFlight) return;
  pollInFlight = true;
  const t0 = performance.now();
  const r = await api('GET', '/me/player', undefined, { quiet: !($('spLogPoll') as HTMLInputElement).checked });
  const t1 = performance.now();
  pollInFlight = false;

  const prev = { uri: sp.uri, playing: sp.playing, has: sp.has, pos: sp.basePos };
  if (r.status === 204) {
    if (sp.has) log('POLL 204: nessuna riproduzione attiva', 'warn');
    sp.has = false;
    sp.playing = false;
    checkPlayConfirmed();
    onSpotifyState(prev);
    return;
  }
  if (r.status !== 200 || !r.data) return;

  const d = r.data;
  // Stima del momento in cui Spotify ha misurato la posizione: metà del tempo di andata e ritorno.
  const measuredAt = t0 + (t1 - t0) / 2;
  const item = d.item ?? {};
  const uri: string = item.uri ?? '';

  if (sp.has && sp.playing && d.is_playing && uri === sp.uri && performance.now() - commandAt > 2500) {
    const predicted = sp.basePos + (measuredAt - sp.baseAt);
    const drift = d.progress_ms - predicted;
    driftSamples.push(drift);
    if (Math.abs(drift) > 500) log(`POLL scarto interpolazione ${Math.round(drift)} ms (rtt ${Math.round(t1 - t0)} ms)`, 'warn');
  }
  if (uri !== sp.uri) log(`POLL brano: ${item.name ?? '?'} — ${(item.artists ?? []).map((a: any) => a.name).join(', ')} (${uri || 'nessun URI'})`);
  if (d.is_playing !== sp.playing || !sp.has) log(`POLL ${d.is_playing ? 'in riproduzione' : 'in pausa'} su ${d.device?.name ?? '?'}`);

  sp = {
    has: true,
    uri,
    name: item.name ?? '',
    artist: (item.artists ?? []).map((a: any) => a.name).join(', '),
    durationMs: item.duration_ms ?? 0,
    basePos: d.progress_ms ?? 0,
    baseAt: measuredAt,
    playing: !!d.is_playing,
    device: d.device?.name ?? '',
  };
  checkPlayConfirmed();
  onSpotifyState(prev);
}

// ---------------------------------------------------------------- Test 2: voce, bip, clip, audioSession

let audioCtx: AudioContext | null = null;
function ctx() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    log(`AUDIOCONTEXT creato, stato ${audioCtx.state}, ${audioCtx.sampleRate} Hz`);
    audioCtx.onstatechange = () => log(`AUDIOCONTEXT stato → ${audioCtx!.state}`, audioCtx!.state === 'running' ? 'info' : 'warn');
  }
  if (audioCtx.state !== 'running') {
    audioCtx.resume().catch((e) => log(`AUDIOCONTEXT resume fallito: ${e}`, 'err'));
  }
  return audioCtx;
}

function beep() {
  const c = ctx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.value = 880;
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.22);
  log(`BIP (AudioContext ${c.state}, musica: ${musicState()})`);
}

function italianVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'it-IT' && v.localService) ?? voices.find((v) => v.lang.startsWith('it'));
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return log('VOCE speechSynthesis non supportato', 'err');
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'it-IT';
  const v = italianVoice();
  if (v) u.voice = v;
  const t0 = performance.now();
  u.onstart = () => {
    log(`VOCE inizio dopo ${Math.round(performance.now() - t0)} ms, voce ${v?.name ?? 'predefinita'} (musica: ${musicState()})`);
    duck(true);
  };
  u.onend = () => {
    log('VOCE fine');
    duck(false);
  };
  u.onerror = (e) => {
    log(`VOCE errore: ${e.error}`, 'err');
    duck(false);
  };
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  log(`VOCE richiesta: "${text}" (${speechSynthesis.getVoices().length} voci disponibili)`);
}

let clipBuffer: AudioBuffer | null = null;
async function playClip() {
  const c = ctx();
  try {
    if (!clipBuffer) {
      const res = await fetch(`${import.meta.env.BASE_URL}voce-squat.m4a`);
      clipBuffer = await c.decodeAudioData(await res.arrayBuffer());
    }
  } catch (e) {
    return log(`CLIP caricamento fallito: ${e}`, 'err');
  }
  const src = c.createBufferSource();
  src.buffer = clipBuffer;
  src.connect(c.destination);
  src.onended = () => {
    log('CLIP fine');
    duck(false);
  };
  duck(true);
  src.start();
  log(`CLIP inizio (musica: ${musicState()})`);
}

function musicState() {
  const parts = [];
  if (sp.has) parts.push(`Spotify ${sp.playing ? 'in riproduzione' : 'in pausa'}`);
  if (audio.src) parts.push(`audio in-app ${audio.paused ? 'in pausa' : 'in riproduzione'}`);
  return parts.join(', ') || 'nessuna';
}

if (audioSessionApi) {
  audioSessionApi.onstatechange = () => log(`AUDIOSESSION stato → ${audioSessionApi.state}`);
}
$('audioSession').onchange = () => {
  const value = ($('audioSession') as HTMLSelectElement).value;
  if (!audioSessionApi) return log('AUDIOSESSION navigator.audioSession non disponibile', 'warn');
  try {
    audioSessionApi.type = value || 'auto';
    log(`AUDIOSESSION type = ${value || 'auto'} → letto "${audioSessionApi.type}", stato ${audioSessionApi.state ?? '?'}`);
  } catch (e) {
    log(`AUDIOSESSION errore: ${e}`, 'err');
  }
};

// ---------------------------------------------------------------- Test 3: wake lock

let wakeLock: WakeLockSentinel | null = null;
let wlWanted = false;
let wlSince = 0;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return log('WAKELOCK non supportato', 'err');
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wlSince = Date.now();
    log('WAKELOCK acquisito', 'ok');
    wakeLock.addEventListener('release', () => {
      log(`WAKELOCK rilasciato dopo ${((Date.now() - wlSince) / 1000).toFixed(0)} s`, 'warn');
      wakeLock = null;
    });
  } catch (e: any) {
    log(`WAKELOCK errore ${e?.name}: ${e?.message}`, 'err');
  }
}

async function setWakeLock(on: boolean) {
  wlWanted = on;
  $('wlToggle').textContent = on ? 'Disattiva wake lock' : 'Attiva wake lock';
  if (on && !wakeLock) await requestWakeLock();
  if (!on && wakeLock) await wakeLock.release();
}

// ---------------------------------------------------------------- Test 5: audio in-app e file persistenti

const audio = $('audio') as HTMLAudioElement;
const fileBlobs: (Blob | null)[] = [null, null];
const fileNames = ['', ''];
let audioSlot = -1;

for (const ev of ['play', 'playing', 'pause', 'ended', 'waiting', 'stalled', 'seeked', 'error', 'loadedmetadata']) {
  audio.addEventListener(ev, () => {
    const extra = ev === 'error' ? ` ${audio.error?.code} ${audio.error?.message}` : ` t=${fmt(audio.currentTime)}`;
    log(`AUDIO ${ev}${extra}`, ev === 'error' || ev === 'stalled' ? 'err' : 'info');
  });
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('spike', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key: string, value: unknown) {
  const db = await idb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('files').objectStore('files').get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

type StoredFile = { name: string; type: string; buf: ArrayBuffer; savedAt: number };

function setSlot(i: number, blob: Blob, name: string, source: string) {
  fileBlobs[i] = blob;
  fileNames[i] = name;
  $(`fileInfo${i}`).textContent = `${name} · ${(blob.size / 1e6).toFixed(1)} MB · ${source}`;
}

async function onFilePicked(i: number, file: File) {
  log(`FILE ${i + 1} scelto: ${file.name}, ${file.type || 'tipo sconosciuto'}, ${(file.size / 1e6).toFixed(1)} MB`);
  setSlot(i, file, file.name, 'appena scelto');
  try {
    // Salvo i byte, non il File: su iOS è il modo più robusto per ritrovarlo dopo un riavvio.
    await idbPut(`track${i}`, { name: file.name, type: file.type, buf: await file.arrayBuffer(), savedAt: Date.now() } satisfies StoredFile);
    log(`FILE ${i + 1} salvato in IndexedDB`, 'ok');
  } catch (e) {
    log(`FILE ${i + 1} salvataggio IndexedDB fallito: ${e}`, 'err');
  }
  logStorage();
}

async function restoreFiles() {
  for (const i of [0, 1]) {
    try {
      const f = await idbGet<StoredFile>(`track${i}`);
      if (!f) {
        log(`FILE ${i + 1}: niente in IndexedDB`);
        continue;
      }
      const age = Math.round((Date.now() - f.savedAt) / 60_000);
      setSlot(i, new Blob([f.buf], { type: f.type }), f.name, `ripristinato da IndexedDB (salvato ${age} min fa)`);
      log(`FILE ${i + 1} ripristinato da IndexedDB: ${f.name}, salvato ${age} min fa`, 'ok');
    } catch (e) {
      log(`FILE ${i + 1} lettura IndexedDB fallita: ${e}`, 'err');
    }
  }
}

async function logStorage() {
  try {
    const persisted = await navigator.storage?.persisted?.();
    const est = await navigator.storage?.estimate?.();
    const text = `storage persistente: ${persisted ? 'sì' : 'no'} · usati ${((est?.usage ?? 0) / 1e6).toFixed(1)} MB su ${((est?.quota ?? 0) / 1e6).toFixed(0)} MB`;
    $('storageInfo').textContent = text;
    log(`STORAGE ${text}`);
  } catch (e) {
    log(`STORAGE errore: ${e}`, 'err');
  }
}

function loadIntoPlayer(i: number) {
  const blob = fileBlobs[i];
  if (!blob) {
    log(`FILE ${i + 1} non scelto`, 'warn');
    return false;
  }
  if (audioSlot !== i) {
    if (audio.src) URL.revokeObjectURL(audio.src);
    audio.src = URL.createObjectURL(blob);
    audioSlot = i;
    log(`AUDIO caricato brano ${i + 1}: ${fileNames[i]}`);
  }
  return true;
}

let gainNode: GainNode | null = null;
function duck(on: boolean) {
  const mode = ($('duckMode') as HTMLSelectElement).value;
  if (mode === 'none' || !audio.src || audio.paused) return;
  const level = on ? 0.25 : 1;
  if (mode === 'volume') {
    audio.volume = level;
    log(`DUCK audio.volume impostato ${level} → letto ${audio.volume}`, audio.volume === level ? 'info' : 'warn');
  } else {
    if (!gainNode) {
      const c = ctx();
      gainNode = c.createGain();
      c.createMediaElementSource(audio).connect(gainNode).connect(c.destination);
      log("GAIN l'audio in-app ora passa da Web Audio (irreversibile fino al ricaricamento)", 'warn');
    }
    gainNode.gain.setTargetAtTime(level, ctx().currentTime, 0.05);
    log(`DUCK GainNode → ${level}`);
  }
}

// ---------------------------------------------------------------- sessione: flusso e indizi (Test 4)

type Engine = 'spotify' | 'local';
type SessionState = 'idle' | 'explain' | 'playing' | 'done';
const ses = {
  state: 'idle' as SessionState,
  engine: 'spotify' as Engine,
  i: 0,
  fired: -1,
  startedAt: 0,
  trackStartedAt: 0,
  lates: [] as number[],
  marks: [] as string[],
};
const uriInputs = [$<HTMLInputElement>('uri0'), $<HTMLInputElement>('uri1')];
uriInputs.forEach((el, i) => {
  el.value = load(`spike.uri${i}`, '');
  el.onchange = () => save(`spike.uri${i}`, el.value.trim());
});

function currentEngine(): Engine {
  return ses.state === 'playing' || ses.state === 'explain' ? ses.engine : (($('engine') as HTMLSelectElement).value as Engine);
}

function enginePos() {
  if (currentEngine() === 'spotify') return { pos: spPos() / 1000, playing: sp.playing };
  return { pos: audio.currentTime, playing: !audio.paused };
}

function startSession() {
  ses.engine = ($('engine') as HTMLSelectElement).value as Engine;
  ses.i = 0;
  ses.startedAt = Date.now();
  ses.lates = [];
  ses.marks = [];
  driftSamples.length = 0;
  suspensions = 0;
  log(`SESSIONE inizio, motore ${ses.engine === 'spotify' ? 'A Spotify' : 'B audio in-app'}`, 'note');
  // Nell'app vera il wake lock partirà da solo con l'allenamento: lo provo già qui.
  if (!wlWanted) setWakeLock(true);
  showExplain();
}

function showExplain() {
  ses.state = 'explain';
  const t = SESSION[ses.i];
  $('sesExplain').textContent = `Brano ${ses.i + 1} di ${SESSION.length} · ${t.exercise}\n\n${t.explain}`;
  $('cueNow').textContent = t.exercise;
  $('cueNext').innerHTML = '&nbsp;';
  log(`SESSIONE spiegazione brano ${ses.i + 1}: ${t.exercise}`);
  renderSession();
}

async function ready() {
  log(`SESSIONE "Sono pronta" brano ${ses.i + 1}`);
  if (ses.engine === 'spotify') {
    const uri = uriInputs[ses.i].value.trim();
    if (await playUri(uri, true)) sessionTrackStarted();
  } else {
    if (!loadIntoPlayer(ses.i)) return;
    audio.currentTime = 0;
    try {
      await audio.play();
      sessionTrackStarted();
    } catch (e) {
      log(`AUDIO play() rifiutato: ${e}`, 'err');
    }
  }
}

function sessionTrackStarted() {
  ses.state = 'playing';
  ses.fired = -1;
  ses.trackStartedAt = performance.now();
  log(`SESSIONE brano ${ses.i + 1} partito`, 'ok');
  renderSession();
}

function endTrack(why: string) {
  if (ses.state !== 'playing') return;
  log(`SESSIONE fine brano ${ses.i + 1} (${why})`, 'note');
  ses.i++;
  if (ses.i < SESSION.length) showExplain();
  else finishSession();
}

function finishSession() {
  ses.state = 'done';
  const mins = ((Date.now() - ses.startedAt) / 60_000).toFixed(1);
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const maxAbs = (a: number[]) => (a.length ? Math.round(Math.max(...a.map(Math.abs))) : 0);
  const lines = [
    `Allenamento finito in ${mins} min`,
    `Indizi mostrati: ${ses.lates.length}, ritardo medio ${avg(ses.lates)} ms, max ${maxAbs(ses.lates)} ms`,
    ses.engine === 'spotify' ? `Scarto interpolazione Spotify: medio ${avg(driftSamples)} ms, max ${maxAbs(driftSamples)} ms su ${driftSamples.length} campioni` : '',
    `Sospensioni del JavaScript: ${suspensions}`,
    `Segni: ${ses.marks.join(', ') || 'nessuno'}`,
  ].filter(Boolean);
  $('sesSummary').textContent = lines.join('\n');
  $('cueNow').textContent = 'Brava! 🎉';
  log(`RIEPILOGO ${lines.join(' · ')}`, 'note');
  renderSession();
}

function stopSession() {
  if (ses.state === 'idle') return;
  log('SESSIONE terminata a mano');
  if (ses.engine === 'spotify' && sp.playing) spPause();
  if (ses.engine === 'local') audio.pause();
  finishSession();
}

// Il brano Spotify è finito? Lo deduco dal polling: o si è fermato alla fine,
// o è partito un altro brano (Autoplay di Spotify) che allora metto in pausa.
function onSpotifyState(prev: { uri: string; playing: boolean; has: boolean; pos: number }) {
  if (ses.state !== 'playing' || ses.engine !== 'spotify') return;
  if (playCheck || performance.now() - ses.trackStartedAt < 4000) return;
  const expected = sessionUri;
  if (!sp.has) return endTrack('Spotify non riporta più nessuna riproduzione');
  if (sp.uri !== expected) {
    if (sp.playing) {
      log(`AUTOPLAY Spotify ha fatto partire un altro brano (${sp.name}): lo metto in pausa`, 'warn');
      spPause();
    }
    return endTrack('cambio brano');
  }
  if (prev.playing && !sp.playing && (sp.basePos === 0 || sp.durationMs - sp.basePos < 2500)) endTrack('arrivato alla fine');
}

audio.addEventListener('ended', () => {
  if (ses.engine === 'local') endTrack('evento ended');
});

function cueTick() {
  const { pos } = enginePos();
  $('sesPos').textContent = fmt(pos);
  if (ses.state !== 'playing') return;
  const cues = SESSION[ses.i].cues;
  let idx = -1;
  cues.forEach((c, k) => {
    if (c.t <= pos) idx = k;
  });
  if (idx !== ses.fired) {
    if (idx > ses.fired && idx >= 0 && pos - cues[idx].t < 1.5) {
      fireCue(idx, pos);
    } else {
      log(`INDIZIO riallineato a #${idx} dopo salto/pausa lunga (pos ${fmt(pos)})`, 'warn');
      $('cueNow').textContent = idx >= 0 ? cues[idx].label : SESSION[ses.i].exercise;
    }
    ses.fired = idx;
  }
  const next = cues[idx + 1];
  const until = next ? next.t - pos : Infinity;
  $('cueNext').textContent = until <= 5 ? `tra ${Math.ceil(until)} s → ${next.label}` : ' ';
}

function fireCue(idx: number, pos: number) {
  const cue = SESSION[ses.i].cues[idx];
  const late = Math.round((pos - cue.t) * 1000);
  ses.lates.push(late);
  log(`INDIZIO #${idx} "${cue.label}" mostrato a ${fmt(pos)} (ritardo ${late} ms)`);
  const el = $('cueNow');
  el.textContent = cue.label;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1500);
  if (($('cueBeep') as HTMLInputElement).checked) beep();
  if (($('cueSpeak') as HTMLInputElement).checked) speak(cue.label.replace(/^\S+ → /, ''));
}

function renderSession() {
  const s = ses.state;
  $('sesStart').hidden = s === 'explain' || s === 'playing';
  $('sesReady').hidden = s !== 'explain';
  $('sesExplain').hidden = s !== 'explain';
  $('sesSummary').hidden = s !== 'done';
  $('sesTrack').textContent =
    s === 'idle' || s === 'done' ? '—' : `Brano ${ses.i + 1}/${SESSION.length} · ${ses.engine === 'spotify' ? 'Spotify' : 'audio in-app'}`;
}

async function sesPause() {
  if (currentEngine() === 'spotify') await spPause();
  else audio.pause();
  log(`SESSIONE pausa a ${fmt(enginePos().pos)}`);
}
async function sesResume() {
  if (currentEngine() === 'spotify') await spResume();
  else await audio.play().catch((e) => log(`AUDIO play() rifiutato: ${e}`, 'err'));
  log(`SESSIONE ripresa a ${fmt(enginePos().pos)}`);
}
async function sesSeek(delta: number) {
  const target = Math.max(0, enginePos().pos + delta);
  log(`SESSIONE salto ${delta > 0 ? '+' : ''}${delta} s → ${fmt(target)}`);
  if (currentEngine() === 'spotify') await spSeek(target * 1000);
  else audio.currentTime = target;
}

function mark() {
  const { pos } = enginePos();
  const text = fmt(pos);
  ses.marks.push(text);
  $('marks').textContent = `Segni: ${ses.marks.join(', ')}`;
  log(`SEGNA ${text} (${currentEngine() === 'spotify' ? `Spotify ${sp.name}` : `audio ${fileNames[audioSlot] ?? ''}`})`, 'note');
}

// ---------------------------------------------------------------- esiti

type Result = { scenario: string; outcome: string; note: string; at: string };
const results = load<Result[]>('spike.results', []);
const scenarioSel = $<HTMLSelectElement>('scenario');
SCENARIOS.forEach((s) => scenarioSel.add(new Option(s)));
for (const o of OUTCOMES) {
  const b = document.createElement('button');
  b.textContent = o;
  b.onclick = () => {
    const noteEl = $<HTMLInputElement>('note');
    const r = { scenario: scenarioSel.value, outcome: o, note: noteEl.value.trim(), at: stamp() };
    results.push(r);
    save('spike.results', results);
    log(`ESITO [${r.scenario}] ${r.outcome}${r.note ? ` — ${r.note}` : ''}`, 'note');
    noteEl.value = '';
    renderResults();
  };
  $('outcomes').appendChild(b);
}

function renderResults() {
  $('results').textContent = results.length ? results.map((r) => `${r.at.slice(0, 5)} ${r.scenario}: ${r.outcome}${r.note ? ` (${r.note})` : ''}`).join('\n') : 'Nessun esito registrato';
  $('results').style.whiteSpace = 'pre-line';
}

$('copyResults').onclick = async () => {
  const rows = SCENARIOS.flatMap((s) => results.filter((r) => r.scenario === s)).map((r) => `| ${r.scenario} | ${r.outcome} | ${r.note} |`);
  const table = ['| Test | Esito | Note |', '| --- | --- | --- |', ...rows].join('\n');
  const ok = await copyText(table);
  log(ok ? 'Tabella risultati copiata' : 'Copia tabella non riuscita', ok ? 'ok' : 'err');
};

// ---------------------------------------------------------------- collegamenti UI

$('spLogin').onclick = login;
$('spLogout').onclick = () => {
  token = null;
  save('spike.token', null);
  log('LOGOUT token cancellato');
};
$('spDevicesBtn').onclick = getDevices;
$('spOpen').onclick = () => log('APRI SPOTIFY deep link spotify: toccato');
$('spPlay').onclick = () => {
  const uri = $<HTMLInputElement>('spUri').value.trim();
  save('spike.spUri', uri);
  playUri(uri);
};
$<HTMLInputElement>('spUri').value = load('spike.spUri', '');
$('spTransfer').onclick = spTransfer;
$('spLadder').onclick = pauseLadder;
// Apre Spotify direttamente sul brano del campo URI: per lei sarebbe un tocco su Spotify invece di cercarlo.
const openTrack = $<HTMLAnchorElement>('spOpenTrack');
const syncOpenTrack = () => (openTrack.href = normalizeUri($<HTMLInputElement>('spUri').value) || 'spotify:');
$('spUri').addEventListener('input', syncOpenTrack);
syncOpenTrack();
openTrack.onclick = () => log(`APRI BRANO IN SPOTIFY ${openTrack.href}`);
$('spPause').onclick = spPause;
$('spResume').onclick = spResume;
$('spSeek').onclick = () => spSeek(Number($<HTMLInputElement>('spSeekSec').value || 0) * 1000);
$('spPollToggle').onclick = () => (pollingOn ? stopPolling() : startPolling());

$('speak').onclick = () => speak('Ora squat!');
$('beep').onclick = beep;
$('clip').onclick = playClip;
$('wlToggle').onclick = () => setWakeLock(!wlWanted);

[0, 1].forEach((i) => {
  const input = $<HTMLInputElement>(`file${i}`);
  input.onchange = () => input.files?.[0] && onFilePicked(i, input.files[0]);
  $(`load${i}`).onclick = () => loadIntoPlayer(i);
});

$('sesStart').onclick = startSession;
$('sesReady').onclick = ready;
$('sesPause').onclick = sesPause;
$('sesResume').onclick = sesResume;
$('sesBack10').onclick = () => sesSeek(-10);
$('sesFwd10').onclick = () => sesSeek(10);
$('mark').onclick = mark;
$('sesStop').onclick = stopSession;

function renderStatus() {
  $('spStatus').textContent = token
    ? `Connesso · token valido ancora ${Math.max(0, Math.round((token.expiresAt - Date.now()) / 60_000))} min · dispositivo: ${selectedDevice?.name ?? 'nessuno scelto'}`
    : 'Non connesso';
  $('spNow').textContent = sp.has
    ? `${sp.name} — ${sp.artist}\n${fmt(spPos() / 1000)} / ${fmt(sp.durationMs / 1000)} · ${sp.playing ? '▶' : '⏸'} · ${sp.device}`
    : '—';
  $('wlStatus').textContent = wakeLock
    ? `attivo da ${fmt((Date.now() - wlSince) / 1000)}`
    : wlWanted
      ? 'richiesto ma NON attivo'
      : 'spento';
}

setInterval(() => {
  cueTick();
  renderStatus();
}, 100);

// ---------------------------------------------------------------- avvio

if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => log(`VOCE elenco voci aggiornato: ${speechSynthesis.getVoices().length}, italiana: ${italianVoice()?.name ?? 'nessuna'}`);
}

logEnvironment();
renderResults();
renderSession();
renderDevices();
await handleRedirect();
if (token) {
  log(`TOKEN salvato trovato, scade tra ${Math.round((token.expiresAt - Date.now()) / 60_000)} min`);
  getDevices();
}
restoreFiles().then(logStorage);
