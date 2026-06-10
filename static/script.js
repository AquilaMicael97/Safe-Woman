/* ════════════════════════════════════════════════
   SAFE WOMAN — Portaria Script
   ════════════════════════════════════════════════ */

// ── Auth ─────────────────────────────────────────
function getToken()    { return sessionStorage.getItem('sw_token') || ''; }
function authHeaders() { return { 'Authorization': 'Bearer ' + getToken() }; }

function logout() {
  fetch('/api/portaria/logout', { method: 'POST', headers: authHeaders() }).finally(() => {
    sessionStorage.clear();
    window.location.replace('/login');
  });
}

// Redireciona para login se não autenticado
(function checkAuth() {
  if (!getToken()) { window.location.replace('/login'); return; }
  const nome = sessionStorage.getItem('sw_nome') || 'Portaria';
  const el = document.getElementById('header-nome');
  if (el) el.textContent = nome;
  document.getElementById('home-title').textContent =
    nome === 'Portaria' ? 'Controle de Acesso' : `Olá, ${nome.split(' ')[0]}`;
})();

// ── Navegação ─────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) { el.classList.add('active'); window.scrollTo(0, 0); }
  if (id === 'home') loadHome();
}

function setLoading(show, msg) {
  document.getElementById('screen-loading').classList.toggle('active', show);
  document.getElementById('loading-msg').textContent = msg || 'Processando...';
}

// ── Upload / Preview ──────────────────────────────
function previewImg(inputId, wrapId, btnId, zoneId) {
  const file = document.getElementById(inputId).files[0];
  if (!file) return;
  const wrap = document.getElementById(wrapId);
  const img  = document.getElementById(wrapId + '-img');
  img.src = URL.createObjectURL(file);
  wrap.classList.add('visible');
  document.getElementById(btnId).disabled = false;
  document.getElementById(zoneId).style.display = 'none';
}

function clearImg(inputId, wrapId, btnId, zoneId) {
  document.getElementById(inputId).value = '';
  document.getElementById(wrapId).classList.remove('visible');
  document.getElementById(btnId).disabled = true;
  document.getElementById(zoneId).style.display = '';
}

function dragOver(e, zoneId) {
  e.preventDefault();
  document.getElementById(zoneId).classList.add('drag-over');
}
function dragLeave(zoneId) {
  document.getElementById(zoneId).classList.remove('drag-over');
}
function dropFile(e, inputId, wrapId, btnId) {
  e.preventDefault();
  const zoneId = e.currentTarget.id;
  dragLeave(zoneId);
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  document.getElementById(inputId).files = dt.files;
  previewImg(inputId, wrapId, btnId, zoneId);
}

// ── Máscare CPF ───────────────────────────────────
function mascaraCPF(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 11);
  if      (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
  else if (v.length > 3) v = v.replace(/^(\d{3})(\d{0,3})/, '$1.$2');
  el.value = v;
}

// ── Escape XSS ────────────────────────────────────
function esc(s) {
  if (!s) return '—';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── HOME — stats e recentes ───────────────────────
async function loadHome() {
  try {
    const data = await fetch('/api/presentes', { headers: authHeaders() }).then(r => r.json());
    const list = data.presentes || [];
    const total    = list.length;
    const alertas  = list.filter(p => p.tipo === 'agressor').length;
    document.getElementById('stat-presentes').textContent = total;
    document.getElementById('stat-alertas').textContent   = alertas;
    renderRecentes(list.slice(0, 6));
  } catch(e) { console.error('home:', e); }
}

function renderRecentes(lista) {
  const el = document.getElementById('lista-recentes');
  if (!lista.length) {
    el.innerHTML = `<div class="empty-state"><div class="ei">📋</div><p>Nenhuma entrada registrada.</p></div>`;
    return;
  }
  el.innerHTML = lista.map(p => {
    const cls  = p.tipo === 'agressor' ? 'alerta' : p.tipo === 'vitima' ? 'outro' : 'ok';
    const icon = p.tipo === 'agressor' ? '🚫' : p.tipo === 'vitima' ? '💜' : '👤';
    const badge = p.tipo === 'agressor' ? 'alerta' : 'ok';
    const bLabel = p.tipo === 'agressor' ? 'ALERTA' : p.tipo === 'vitima' ? 'Vítima' : 'OK';
    return `<div class="recente-row">
      <div class="rec-avatar ${cls}">${icon}</div>
      <div class="rec-info">
        <div class="rec-nome">${esc(p.nome)}</div>
        <div class="rec-cpf">${esc(p.cpf)}</div>
      </div>
      <span class="rec-badge ${badge}">${bLabel}</span>
    </div>`;
  }).join('');
}

// ── ENVIO CNH ─────────────────────────────────────
async function enviarCNH() {
  const file = document.getElementById('foto-cnh').files[0];
  if (!file) return;
  const btn = document.getElementById('btn-verificar');
  btn.classList.add('loading'); btn.disabled = true;
  setLoading(true, 'Verificando CNH...');
  const form = new FormData();
  form.append('foto', file);
  try {
    const data = await fetch('/api/verificar-cnh', {
      method: 'POST', headers: authHeaders(), body: form,
    }).then(r => r.json());
    setLoading(false);
    renderVerificacao(data);
  } catch { setLoading(false); renderErro('Falha na conexão.'); }
  finally { btn.classList.remove('loading'); btn.disabled = false; }
}

async function verificarCpf(inputId) {
  const cpf = document.getElementById(inputId).value.trim();
  if (cpf.replace(/\D/g,'').length < 11) { alert('CPF incompleto.'); return; }
  setLoading(true, 'Verificando CPF...');
  try {
    const data = await fetch('/api/verificar-cpf?cpf=' + encodeURIComponent(cpf), {
      headers: authHeaders(),
    }).then(r => r.json());
    setLoading(false);
    renderVerificacao(data);
  } catch { setLoading(false); renderErro('Falha na conexão.'); }
}

// ── ENVIO MEDIDA ──────────────────────────────────
async function enviarMedida() {
  const file = document.getElementById('foto-mp').files[0];
  if (!file) return;
  const btn = document.getElementById('btn-cadastrar');
  btn.classList.add('loading'); btn.disabled = true;
  setLoading(true, 'Lendo medida protetiva...');
  const form = new FormData();
  form.append('foto', file);
  try {
    const data = await fetch('/api/cadastrar-medida', {
      method: 'POST', headers: authHeaders(), body: form,
    }).then(r => r.json());
    setLoading(false);
    renderCadastro(data);
  } catch { setLoading(false); renderErro('Falha na conexão.'); }
  finally { btn.classList.remove('loading'); btn.disabled = false; }
}

// ── SAÍDA ─────────────────────────────────────────
async function enviarSaida() {
  const file = document.getElementById('foto-saida').files[0];
  if (!file) return;
  const btn = document.getElementById('btn-saida');
  btn.classList.add('loading'); btn.disabled = true;
  setLoading(true, 'Registrando saída...');
  const form = new FormData();
  form.append('foto', file);
  try {
    const data = await fetch('/api/saida', {
      method: 'POST', headers: authHeaders(), body: form,
    }).then(r => r.json());
    setLoading(false);
    renderSaida(data);
  } catch { setLoading(false); renderErro('Falha na conexão.'); }
  finally { btn.classList.remove('loading'); btn.disabled = false; }
}

async function saidaCpf() {
  const cpf = document.getElementById('cpf-saida').value.trim();
  if (cpf.replace(/\D/g,'').length < 11) { alert('CPF incompleto.'); return; }
  setLoading(true, 'Registrando saída...');
  try {
    const data = await fetch('/api/saida-cpf?cpf=' + encodeURIComponent(cpf), {
      method: 'POST', headers: authHeaders(),
    }).then(r => r.json());
    setLoading(false);
    renderSaida(data);
  } catch { setLoading(false); renderErro('Falha na conexão.'); }
}

// ── RENDERS ───────────────────────────────────────
const NIVEL_CFG = {
  'vermelho-urgente': { bg:'bg-vermelho-urg', icon:'🚨', nivel:'PERIGO IMEDIATO',  titulo:'AGRESSOR + VÍTIMA NO LOCAL' },
  'vermelho':         { bg:'bg-vermelho',     icon:'🚫', nivel:'Acesso Negado',    titulo:'AGRESSOR IDENTIFICADO' },
  'amarelo-urgente':  { bg:'bg-amarelo-urg',  icon:'⚠️', nivel:'ATENÇÃO URGENTE', titulo:'VÍTIMA — AGRESSOR PRESENTE' },
  'amarelo':          { bg:'bg-amarelo',      icon:'⚠️', nivel:'Atenção',          titulo:'VÍTIMA CADASTRADA' },
  'verde':            { bg:'bg-verde',        icon:'✅', nivel:'Acesso Liberado',  titulo:'SEM RESTRIÇÕES' },
  'cinza':            { bg:'bg-cinza',        icon:'❓', nivel:'CPF não lido',     titulo:'VERIFICAÇÃO MANUAL' },
};

function renderVerificacao(data) {
  if (data.status === 'erro') { renderErro(data.mensagem); return; }
  document.getElementById('res-screen-title').textContent = 'Resultado da Verificação';

  const cfg  = NIVEL_CFG[data.nivel] || NIVEL_CFG.cinza;
  const hero = document.getElementById('res-hero');
  hero.className = 'res-hero ' + cfg.bg;
  if (data.nivel?.includes('vermelho')) hero.classList.add('pulse');

  document.getElementById('res-icon').textContent   = cfg.icon;
  document.getElementById('res-nivel').textContent  = cfg.nivel;
  document.getElementById('res-titulo').textContent = cfg.titulo;

  const urg = document.getElementById('res-urgente');
  if (data.urgente) {
    urg.textContent = '⚡ CONTRAPARTE PRESENTE NO LOCAL';
    urg.classList.add('show');
  } else { urg.classList.remove('show'); }

  let presHTML = '';
  (data.vitimas_dentro||[]).forEach(v => {
    presHTML += `<div class="presenca-alerta vitima"><div class="pa-title">Vítima no local</div><div class="pa-nome">${esc(v.nome)}</div></div>`;
  });
  (data.agressores_dentro||[]).forEach(a => {
    presHTML += `<div class="presenca-alerta agressor"><div class="pa-title">Agressor no local</div><div class="pa-nome">${esc(a.nome)}</div></div>`;
  });
  document.getElementById('res-presencas').innerHTML = presHTML;

  let info = '';
  if (data.nome)            info += infoCard('Nome',        data.nome);
  if (data.cpf)             info += infoCard('CPF',         data.cpf);
  if (data.data_nascimento) info += infoCard('Nascimento',  data.data_nascimento);
  if (data.mensagem)        info += infoCard('Situação',    data.mensagem);
  document.getElementById('res-info').innerHTML = info;

  let medHTML = '';
  (data.medidas_ativas||[]).forEach(m => {
    medHTML += `<div class="medida-card">
      <div class="mc-titulo">Processo ${esc(m.processo)}</div>
      <div class="mc-row">Vítima: <span>${esc(m.vitima)}</span></div>
      <div class="mc-row">Emissão: <span>${esc(m.data_emissao)||'—'}</span> &nbsp;·&nbsp; Vara: <span>${esc(m.vara)||'—'}</span></div>
    </div>`;
  });
  document.getElementById('res-medidas').innerHTML = medHTML;

  document.getElementById('cpf-fallback').style.display = data.nivel === 'cinza' ? '' : 'none';
  showScreen('resultado');
}

function renderCadastro(data) {
  if (data.status === 'erro') { renderErro(data.mensagem); return; }
  document.getElementById('res-screen-title').textContent = 'Cadastro de Medida';

  const hero = document.getElementById('res-hero');
  if (data.alerta) {
    const isUrgente = data.nivel === 'vermelho-urgente';
    hero.className = 'res-hero ' + (isUrgente ? 'bg-vermelho-urg pulse' : 'bg-vermelho');
    document.getElementById('res-icon').textContent   = isUrgente ? '🚨' : '⚠️';
    document.getElementById('res-nivel').textContent  = 'ALERTA';
    document.getElementById('res-titulo').textContent = esc(data.mensagem_alerta);
    const urg = document.getElementById('res-urgente');
    urg.textContent = data.agressor_presente ? '⚡ Agressor PRESENTE no local!' : '⚡ Vítima presente no local';
    urg.classList.add('show');
  } else {
    hero.className = 'res-hero bg-cadastro';
    document.getElementById('res-icon').textContent   = data.ja_existia ? '⚠️' : '✅';
    document.getElementById('res-nivel').textContent  = data.ja_existia ? 'Já cadastrada' : 'Cadastro realizado';
    document.getElementById('res-titulo').textContent = data.ja_existia ? 'Medida já estava no sistema' : 'Medida registrada com sucesso';
    document.getElementById('res-urgente').classList.remove('show');
  }

  document.getElementById('res-presencas').innerHTML = '';
  document.getElementById('res-info').innerHTML =
    infoCard('Processo', data.numero_processo) +
    infoCard('Vítima',   data.nome_vitima) +
    infoCard('Agressor', data.nome_agressor) +
    (data.cpf_agressor && data.cpf_agressor !== 'Não encontrado' ? infoCard('CPF do agressor', data.cpf_agressor) : '') +
    infoCard('Vara', data.vara);
  document.getElementById('res-medidas').innerHTML = '';
  document.getElementById('cpf-fallback').style.display = 'none';
  showScreen('resultado');
}

function renderSaida(data) {
  if (data.status === 'erro') { renderErro(data.mensagem); return; }
  document.getElementById('res-screen-title').textContent = 'Saída Registrada';

  const hero = document.getElementById('res-hero');
  hero.className = 'res-hero bg-saida';
  document.getElementById('res-icon').textContent   = '👋';
  document.getElementById('res-nivel').textContent  = 'Saída registrada';
  document.getElementById('res-titulo').textContent = 'Saída confirmada';
  document.getElementById('res-urgente').classList.remove('show');
  document.getElementById('res-presencas').innerHTML = '';

  const tipoBadge = { vitima:'💜 Vítima', agressor:'🚫 Agressor', outro:'👤 Visitante' };
  document.getElementById('res-info').innerHTML =
    infoCard('Nome',    data.nome + ' <small style="color:var(--text3)">' + (tipoBadge[data.tipo]||'') + '</small>') +
    infoCard('CPF',     data.cpf) +
    infoCard('Entrada', new Date(data.entrada_em).toLocaleString('pt-BR', {hour:'2-digit',minute:'2-digit'}));
  document.getElementById('res-medidas').innerHTML = '';
  document.getElementById('cpf-fallback').style.display = 'none';
  showScreen('resultado');
}

function renderErro(msg) {
  document.getElementById('res-screen-title').textContent = 'Erro';
  const hero = document.getElementById('res-hero');
  hero.className = 'res-hero bg-erro';
  document.getElementById('res-icon').textContent   = '❌';
  document.getElementById('res-nivel').textContent  = 'Erro';
  document.getElementById('res-titulo').textContent = 'Não foi possível processar';
  document.getElementById('res-urgente').classList.remove('show');
  document.getElementById('res-presencas').innerHTML = '';
  document.getElementById('res-info').innerHTML = infoCard('Motivo', msg);
  document.getElementById('res-medidas').innerHTML = '';
  document.getElementById('cpf-fallback').style.display = 'none';
  showScreen('resultado');
}

function infoCard(label, value) {
  if (!value || value === 'Não encontrado' || value === 'Não identificada') return '';
  return `<div class="info-card">
    <span class="info-label">${label}</span>
    <span class="info-value">${value}</span>
  </div>`;
}

// ── Init ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadHome();
  setInterval(loadHome, 30_000);
});
