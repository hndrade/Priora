// Claude Usage Widget — renderer

const $ = (id) => document.getElementById(id);

const views = { main: $('view-main'), token: $('view-token'), settings: $('view-settings') };
let usage = null;
let status = null;
let pollSec = 120;
let nextPollAt = 0;

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function show(view) {
  Object.entries(views).forEach(([k, el]) => el.classList.toggle('hidden', k !== view));
}

// ── Formatação ──────────────────────────────────────────────

function fmtCountdown(epoch) {
  const s = Math.max(0, epoch - Math.floor(Date.now() / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

function fmtResetClock(epoch) {
  const dt = new Date(epoch * 1000);
  const hhmm = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  const today = new Date();
  if (dt.toDateString() === today.toDateString()) return hhmm;
  return `${DIAS[dt.getDay()]} ${hhmm}`;
}

function level(pct) { return pct < 70 ? 'ok' : pct < 90 ? 'warn' : 'bad'; }

// ── Render ──────────────────────────────────────────────────

function renderWindow(prefix, pct, resetEpoch) {
  const lv = level(pct);
  const pctEl = $(`${prefix}-pct`);
  pctEl.textContent = `${Math.round(pct)}%`;
  pctEl.className = `window-pct pct-${lv}`;
  const bar = $(`${prefix}-bar`);
  bar.style.width = `${Math.min(100, pct)}%`;
  bar.className = `bar-fill bar-${lv}`;
  $(`${prefix}-reset`).textContent = resetEpoch
    ? `reseta em ${fmtCountdown(resetEpoch)} (${fmtResetClock(resetEpoch)})`
    : '';
}

function renderChip() {
  const chip = $('chip');
  if (!usage || !usage.ok) {
    chip.textContent = 'offline';
    chip.className = 'chip';
    return;
  }
  const map = {
    allowed: ['ok', 'ok'],
    allowed_warning: ['atenção', 'warn'],
    rejected: ['bloqueado', 'bad'],
  };
  const [label, cls] = map[usage.statusOverall] || [usage.statusOverall || '—', ''];
  chip.textContent = label;
  chip.className = `chip ${cls}`;
}

function renderBanner() {
  const banner = $('banner');
  if (usage && !usage.ok) {
    banner.classList.remove('hidden');
    banner.classList.remove('info');
    banner.textContent = usage.error === 'auth_failed'
      ? 'Token inválido ou expirado — abra ⚙ e troque o token.'
      : usage.error && usage.error.startsWith('net_')
        ? 'Sem conexão com a API — tentando de novo…'
        : `Falha ao consultar a API (${usage.error || '?'}).`;
    return;
  }
  if (status && status.incidents > 0) {
    banner.classList.remove('hidden');
    banner.classList.add('info');
    banner.textContent = `Incidente ativo: ${status.name || 'ver status.claude.com'}`;
    return;
  }
  banner.classList.add('hidden');
}

function renderSpark() {
  const canvas = $('spark');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const hist = (usage && usage.history) || [];
  if (hist.length < 2) return;
  const w = canvas.width, h = canvas.height;
  const draw = (key, color) => {
    ctx.beginPath();
    hist.forEach((p, i) => {
      const x = (i / (hist.length - 1)) * (w - 2) + 1;
      const y = h - 2 - (Math.min(100, p[key]) / 100) * (h - 4);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  draw('d7', 'rgba(74, 222, 128, 0.75)');
  draw('h5', '#d97757');
}

function renderUsage() {
  renderChip();
  renderBanner();
  if (!usage || !usage.ok) return;
  renderWindow('h5', usage.h5, usage.h5Reset);
  renderWindow('d7', usage.d7, usage.d7Reset);
  const claim = $('claim');
  claim.innerHTML = usage.repClaim === 'seven_day'
    ? 'limita primeiro: <b>7 dias</b>'
    : usage.repClaim === 'five_hour'
      ? 'limita primeiro: <b>5 horas</b>'
      : '';
  renderSpark();
}

// tick de 1 s: contadores de reset + barra coral até o próximo refresh
setInterval(() => {
  if (usage && usage.ok) {
    if (usage.h5Reset) $('h5-reset').textContent = `reseta em ${fmtCountdown(usage.h5Reset)} (${fmtResetClock(usage.h5Reset)})`;
    if (usage.d7Reset) $('d7-reset').textContent = `reseta em ${fmtCountdown(usage.d7Reset)} (${fmtResetClock(usage.d7Reset)})`;
  }
  if (nextPollAt) {
    const remain = Math.max(0, nextPollAt - Date.now());
    $('refresh-bar').style.width = `${100 - (remain / (pollSec * 1000)) * 100}%`;
  }
}, 1000);

// ── Ações ───────────────────────────────────────────────────

function refreshNow() {
  $('btn-refresh').classList.add('spin');
  window.widget.refresh();
}

$('btn-refresh').addEventListener('click', refreshNow);
$('refresh-track').addEventListener('click', refreshNow);
$('btn-close').addEventListener('click', () => window.widget.quit());
$('btn-quit').addEventListener('click', () => window.widget.quit());

$('btn-settings').addEventListener('click', () => {
  if (views.settings.classList.contains('hidden')) show('settings');
  else show('main');
});
$('btn-settings-back').addEventListener('click', () => show('main'));

$('btn-interval').addEventListener('click', async () => {
  pollSec = await window.widget.cyclePoll();
  $('btn-interval').textContent = pollSec < 60 ? `${pollSec} s` : `${pollSec / 60} min`;
});

$('btn-autolaunch').addEventListener('click', async function () {
  const enabled = await window.widget.setAutoLaunch(this.textContent === 'não');
  this.textContent = enabled ? 'sim' : 'não';
});

$('opacity-range').addEventListener('input', function () {
  window.widget.setOpacity(parseFloat(this.value));
});

$('btn-change-token').addEventListener('click', () => {
  $('btn-token-cancel').classList.remove('hidden');
  $('token-error').classList.add('hidden');
  show('token');
  $('token-input').focus();
});
$('btn-token-cancel').addEventListener('click', () => show('main'));

$('btn-token-save').addEventListener('click', saveToken);
$('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveToken(); });

async function saveToken() {
  const btn = $('btn-token-save');
  const err = $('token-error');
  btn.disabled = true;
  btn.textContent = 'Validando…';
  const res = await window.widget.setToken($('token-input').value);
  btn.disabled = false;
  btn.textContent = 'Salvar';
  if (res.ok) {
    $('token-input').value = '';
    usage = res.usage;
    pollSec = usage.pollSec;
    nextPollAt = usage.nextPollAt;
    renderUsage();
    show('main');
  } else {
    err.textContent = res.error === 'auth_failed'
      ? 'Token rejeitado pela API — confira se veio de `claude setup-token`.'
      : res.error === 'empty'
        ? 'Cole o token antes de salvar.'
        : `Falha ao validar (${res.error}).`;
    err.classList.remove('hidden');
  }
}

// ── Eventos do processo principal ───────────────────────────

window.widget.onUsage((data) => {
  $('btn-refresh').classList.remove('spin');
  usage = data;
  pollSec = data.pollSec || pollSec;
  nextPollAt = data.nextPollAt || 0;
  if (data.error === 'no_token' && views.token.classList.contains('hidden')) {
    $('btn-token-cancel').classList.add('hidden');
    show('token');
    return;
  }
  renderUsage();
});

window.widget.onStatus((data) => {
  status = data;
  renderBanner();
});

window.widget.onPolling(() => $('btn-refresh').classList.add('spin'));

// ── Boot ────────────────────────────────────────────────────

(async () => {
  const init = await window.widget.init();
  pollSec = init.cfg.pollSec;
  $('btn-interval').textContent = pollSec < 60 ? `${pollSec} s` : `${pollSec / 60} min`;
  $('btn-autolaunch').textContent = init.cfg.autoLaunch ? 'sim' : 'não';
  $('opacity-range').value = init.cfg.opacity;
  status = init.status;
  if (!init.hasToken) {
    $('btn-token-cancel').classList.add('hidden');
    show('token');
    return;
  }
  if (init.usage) {
    usage = init.usage;
    nextPollAt = init.usage.nextPollAt || 0;
    renderUsage();
  }
})();
