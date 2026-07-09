// Claude Usage Widget — processo principal (Electron)
//
// Porte para desktop do "Claude Usage Stick" (ESP32-S3 + LVGL):
// faz um POST mínimo (max_tokens: 1) em https://api.anthropic.com/v1/messages
// com o token OAuth do Claude Code e lê o uso das janelas de 5 h / 7 dias
// direto dos headers anthropic-ratelimit-unified-*. O corpo da resposta é
// descartado — o consumo de quota é desprezível.

const { app, BrowserWindow, Tray, Menu, ipcMain, safeStorage, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

const MESSAGES_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const STATUS_ENDPOINT = 'https://status.claude.com/api/v2/incidents/unresolved.json';
const ANTHROPIC_VERSION = '2023-06-01';
const PROBE_MODEL = 'claude-haiku-4-5-20251001';
const USER_AGENT = 'claude-code/2.1.5';
const API_TIMEOUT_MS = 15000;

const POLL_CHOICES = [30, 60, 120, 300]; // segundos
const STATUS_POLL_SEC = 300;
const HISTORY_MAX = 288; // pontos persistidos do gráfico de tendência

let win = null;
let tray = null;
let cfg = null;
let history = [];
let lastUsage = null;
let lastStatus = null;
let pollTimer = null;
let statusTimer = null;
let nextPollAt = 0;

const cfgPath = () => path.join(app.getPath('userData'), 'config.json');
const histPath = () => path.join(app.getPath('userData'), 'history.json');

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function saveJson(file, obj) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(obj));
  } catch { /* disco cheio/sem permissão: segue sem persistir */ }
}

// ── Config ──────────────────────────────────────────────────

function loadCfg() {
  cfg = Object.assign({
    pollSec: 120,
    opacity: 1,
    x: null,
    y: null,
    autoLaunch: false,
    tokenEnc: null,   // token cifrado via DPAPI (safeStorage), base64
    tokenPlain: null, // fallback quando safeStorage indisponível, base64
  }, loadJson(cfgPath(), {}));
}

function saveCfg() { saveJson(cfgPath(), cfg); }

function publicCfg() {
  return { pollSec: cfg.pollSec, opacity: cfg.opacity, autoLaunch: cfg.autoLaunch };
}

// ── Token ───────────────────────────────────────────────────

function setToken(token) {
  if (safeStorage.isEncryptionAvailable()) {
    cfg.tokenEnc = safeStorage.encryptString(token).toString('base64');
    cfg.tokenPlain = null;
  } else {
    cfg.tokenPlain = Buffer.from(token, 'utf8').toString('base64');
    cfg.tokenEnc = null;
  }
  saveCfg();
}

function getToken() {
  try {
    if (cfg.tokenEnc && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(cfg.tokenEnc, 'base64'));
    }
    if (cfg.tokenPlain) return Buffer.from(cfg.tokenPlain, 'base64').toString('utf8');
  } catch { /* config corrompida ou de outra máquina: cai no env */ }
  return process.env.CLAUDE_CODE_OAUTH_TOKEN || null;
}

// ── API Anthropic (mesmos headers do firmware) ──────────────

function fetchUsage(token) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: PROBE_MODEL,
      max_tokens: 1,
      messages: [{ role: 'user', content: '.' }],
    });
    const req = https.request(MESSAGES_ENDPOINT, {
      method: 'POST',
      timeout: API_TIMEOUT_MS,
      headers: {
        'Authorization': `Bearer ${token}`,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-beta': 'oauth-2025-04-20',
        'content-type': 'application/json',
        'User-Agent': USER_AGENT,
        'content-length': Buffer.byteLength(body),
      },
    }, (res) => {
      res.resume(); // corpo descartado — só os headers importam
      const h = res.headers;
      const h5u = h['anthropic-ratelimit-unified-5h-utilization'];
      const d7u = h['anthropic-ratelimit-unified-7d-utilization'];
      if (h5u === undefined && d7u === undefined) {
        resolve({
          ok: false,
          error: res.statusCode === 401 ? 'auth_failed' : `no_usage_h_${res.statusCode}`,
        });
        return;
      }
      resolve({
        ok: true,
        at: Date.now(),
        h5: parseFloat(h5u || '0') * 100,
        d7: parseFloat(d7u || '0') * 100,
        h5Reset: parseInt(h['anthropic-ratelimit-unified-5h-reset'] || '0', 10),
        d7Reset: parseInt(h['anthropic-ratelimit-unified-7d-reset'] || '0', 10),
        statusOverall: h['anthropic-ratelimit-unified-status'] || '',
        status5h: h['anthropic-ratelimit-unified-5h-status'] || '',
        status7d: h['anthropic-ratelimit-unified-7d-status'] || '',
        repClaim: h['anthropic-ratelimit-unified-representative-claim'] || '',
        overageStatus: h['anthropic-ratelimit-unified-overage-status'] || '',
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ ok: false, error: `net_${e.code || e.message}` }));
    req.write(body);
    req.end();
  });
}

function fetchStatusPage() {
  https.get(STATUS_ENDPOINT, { headers: { 'User-Agent': USER_AGENT }, timeout: API_TIMEOUT_MS }, (res) => {
    let buf = '';
    res.on('data', (c) => { buf += c; });
    res.on('end', () => {
      try {
        const j = JSON.parse(buf);
        const incidents = j.incidents || [];
        lastStatus = { incidents: incidents.length, name: incidents[0] ? incidents[0].name : '' };
        send('status', lastStatus);
      } catch { /* resposta inesperada: mantém o último status */ }
    });
  }).on('error', () => { /* sem rede: mantém o último status */ });
}

// ── Polling ─────────────────────────────────────────────────

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

async function poll() {
  const token = getToken();
  if (!token) {
    lastUsage = { ok: false, error: 'no_token' };
    send('usage', withMeta(lastUsage));
    return;
  }
  send('polling', true);
  const data = await fetchUsage(token);
  lastUsage = data;
  if (data.ok) {
    history.push({ t: data.at, h5: data.h5, d7: data.d7 });
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    saveJson(histPath(), history);
  }
  nextPollAt = Date.now() + cfg.pollSec * 1000;
  send('usage', withMeta(data));
  updateTray();
}

function withMeta(usage) {
  return Object.assign({}, usage, {
    history: history.slice(-60),
    nextPollAt,
    pollSec: cfg.pollSec,
  });
}

function schedulePoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, cfg.pollSec * 1000);
  nextPollAt = Date.now() + cfg.pollSec * 1000;
}

// ── Tray ────────────────────────────────────────────────────

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar widget', click: () => { if (win) { win.show(); win.focus(); } } },
    { label: 'Atualizar agora', click: () => { poll(); schedulePoll(); } },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ]));
  tray.setToolTip('Claude Usage Widget');
  tray.on('click', () => { if (win) { win.show(); win.focus(); } });
}

function updateTray() {
  if (!tray || !lastUsage) return;
  tray.setToolTip(lastUsage.ok
    ? `Claude · 5h: ${Math.round(lastUsage.h5)}% · 7d: ${Math.round(lastUsage.d7)}%`
    : 'Claude Usage Widget — sem dados');
}

// ── Janela ──────────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
    width: 336,
    height: 284,
    x: cfg.x ?? undefined,
    y: cfg.y ?? undefined,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // 'screen-saver' mantém o widget acima até de janelas fullscreen borderless
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('moved', () => {
    const [x, y] = win.getPosition();
    cfg.x = x; cfg.y = y;
    saveCfg();
  });
  win.on('closed', () => { win = null; });
}

// ── IPC ─────────────────────────────────────────────────────

ipcMain.handle('init', () => ({
  hasToken: !!getToken(),
  cfg: publicCfg(),
  usage: lastUsage ? withMeta(lastUsage) : null,
  status: lastStatus,
}));

ipcMain.handle('refresh', () => { poll(); schedulePoll(); });

ipcMain.handle('set-token', async (_e, token) => {
  token = String(token || '').trim();
  if (!token) return { ok: false, error: 'empty' };
  const test = await fetchUsage(token);
  if (!test.ok) return { ok: false, error: test.error };
  setToken(token);
  lastUsage = test;
  history.push({ t: test.at, h5: test.h5, d7: test.d7 });
  saveJson(histPath(), history);
  nextPollAt = Date.now() + cfg.pollSec * 1000;
  schedulePoll();
  updateTray();
  return { ok: true, usage: withMeta(test) };
});

ipcMain.handle('cycle-poll', () => {
  const i = POLL_CHOICES.indexOf(cfg.pollSec);
  cfg.pollSec = POLL_CHOICES[(i + 1) % POLL_CHOICES.length];
  saveCfg();
  schedulePoll();
  return cfg.pollSec;
});

ipcMain.handle('set-auto-launch', (_e, enabled) => {
  cfg.autoLaunch = !!enabled;
  saveCfg();
  app.setLoginItemSettings({ openAtLogin: cfg.autoLaunch });
  return cfg.autoLaunch;
});

ipcMain.handle('set-opacity', (_e, value) => {
  cfg.opacity = Math.min(1, Math.max(0.4, Number(value) || 1));
  saveCfg();
  if (win) win.setOpacity(cfg.opacity);
  return cfg.opacity;
});

ipcMain.handle('quit', () => app.quit());

// ── Ciclo de vida ───────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

  app.whenReady().then(() => {
    loadCfg();
    history = loadJson(histPath(), []);
    createWindow();
    createTray();
    if (win) win.setOpacity(cfg.opacity);
    poll();
    schedulePoll();
    fetchStatusPage();
    statusTimer = setInterval(fetchStatusPage, STATUS_POLL_SEC * 1000);
  });

  app.on('window-all-closed', () => app.quit());
}
