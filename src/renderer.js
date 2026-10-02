// ---------- Avatar ----------
// Define a foto do usuário no avatar (URL ou data URI); sem foto mostra o ícone padrão.
function setAvatar(url) {
  const img = document.getElementById('avatar-img');
  const fallback = document.getElementById('avatar-fallback');
  if (url) { img.src = url; img.hidden = false; fallback.style.display = 'none'; }
  else { img.hidden = true; fallback.style.display = ''; }
}
window.setAvatar = setAvatar;
setAvatar(null);

// ---------- Utilitários ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Remove acentos e caracteres especiais (mantém letras A-Z, números e espaço) e capitaliza cada palavra.
function cleanName(v, final = false) {
  let s = String(v).normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Za-z0-9 ]/g, '').replace(/ {2,}/g, ' ').replace(/^ /, '');
  s = s.toLowerCase().replace(/(^| )(\p{L})/gu, (_, sp, ch) => sp + ch.toUpperCase());
  return final ? s.trim() : s;
}

// ---------- Armazenamento (local, por enquanto) ----------
const db = {
  all(entity) {
    try { return JSON.parse(localStorage.getItem('souzant:' + entity)) || []; } catch { return []; }
  },
  save(entity, rows) { localStorage.setItem('souzant:' + entity, JSON.stringify(rows)); },
  nextSeq(entity) {
    const k = 'souzant:seq:' + entity;
    const max = this.all(entity).reduce((m, r) => Math.max(m, Number(r.codigo) || 0), 0);
    const n = Math.max(Number(localStorage.getItem(k)) || 0, max) + 1; // nunca reaproveita códigos excluídos
    localStorage.setItem(k, String(n));
    return n;
  }
};

// ---------- Cadastros ----------
// Tipos: seq (código sequencial), code (código manual), name (texto capitalizado), status (A/I), ref (código de outro cadastro)
const entities = {
  colaboradores: {
    title: 'Colaboradores', singular: 'colaborador',
    fields: [
      { key: 'codigo', label: 'Código', type: 'seq' },
      { key: 'nome', label: 'Nome', type: 'name' },
      { key: 'situacao', label: 'Situação', type: 'status' }
    ]
  },
  montadoras: {
    title: 'Montadoras', singular: 'montadora',
    fields: [
      { key: 'codigo', label: 'Código', type: 'seq' },
      { key: 'nome', label: 'Nome', type: 'name' },
      { key: 'situacao', label: 'Situação', type: 'status' }
    ]
  },
  pecas: {
    title: 'Peças', singular: 'peça',
    fields: [
      { key: 'codigo', label: 'Código', type: 'code' },
      { key: 'descricao', label: 'Descrição', type: 'name' },
      { key: 'projeto', label: 'Projeto', type: 'ref', ref: 'projetos' },
      { key: 'montadora', label: 'Montadora', type: 'ref', ref: 'montadoras' }
    ]
  },
  inspecoes: {
    title: 'Inspeções/Reprovas', singular: 'inspeção',
    fields: [
      { key: 'codigo', label: 'Código', type: 'seq' },
      { key: 'data', label: 'Data', type: 'date' },
      { key: 'peca', label: 'Peça', type: 'ref', ref: 'pecas', alnum: true },
      { key: 'posto', label: 'Posto de trabalho', type: 'ref', ref: 'postos' },
      { key: 'colaborador', label: 'Colaborador', type: 'ref', ref: 'colaboradores' },
      { key: 'resultado', label: 'Resultado', type: 'result' }
    ]
  },
  postos: {
    title: 'Postos de trabalho', singular: 'posto de trabalho',
    fields: [
      { key: 'codigo', label: 'Código', type: 'seq' },
      { key: 'descricao', label: 'Descrição', type: 'name' }
    ]
  },
  projetos: {
    title: 'Projetos', singular: 'projeto',
    fields: [
      { key: 'codigo', label: 'Código', type: 'seq' },
      { key: 'nome', label: 'Nome', type: 'name' },
      { key: 'montadora', label: 'Montadora', type: 'ref', ref: 'montadoras' }
    ]
  }
};

// Quem referencia quem (impede excluir registro em uso)
const usedBy = {
  montadoras: [['projetos', 'montadora'], ['pecas', 'montadora']],
  projetos: [['pecas', 'projeto']],
  pecas: [['inspecoes', 'peca']],
  postos: [['inspecoes', 'posto']],
  colaboradores: [['inspecoes', 'colaborador']]
};

// ---------- Telas ----------
const screens = {
  '/analise/dashboard/nao-conformidades': { path: 'Análise › Dashboard', title: 'Não Conformidades', dashboard: true },
  '/apontamento/inspecoes-reprovas': { path: 'Apontamento', title: 'Inspeções/Reprovas', entity: 'inspecoes' },
  '/cadastro/colaboradores': { path: 'Cadastro', title: 'Colaboradores', entity: 'colaboradores' },
  '/cadastro/montadoras': { path: 'Cadastro', title: 'Montadoras', entity: 'montadoras' },
  '/cadastro/pecas': { path: 'Cadastro', title: 'Peças', entity: 'pecas' },
  '/cadastro/postos-de-trabalho': { path: 'Cadastro', title: 'Postos de trabalho', entity: 'postos' },
  '/cadastro/projetos': { path: 'Cadastro', title: 'Projetos', entity: 'projetos' },
  '/perfil': { path: 'Conta', title: 'Perfil', profile: true }
};

// ---------- Perfil ----------
const profileStore = {
  get() { try { return JSON.parse(localStorage.getItem('souzant:profile')) || {}; } catch { return {}; } },
  set(p) { localStorage.setItem('souzant:profile', JSON.stringify(p)); }
};
setAvatar(profileStore.get().foto || null);

function profileHtml() {
  return `<div class="breadcrumb">Conta</div><h1>Meu perfil</h1>` +
    `<div class="card profile-card"><div><div class="profile-photo" id="pf-photo"></div>` +
    `<div class="photo-actions"><button class="btn ghost" id="pf-pick" type="button">Alterar foto</button>` +
    `<button class="link danger" id="pf-remove" type="button">Remover</button></div>` +
    `<input type="file" id="pf-file" accept="image/*" hidden></div>` +
    `<form class="profile-form" id="pf-form" novalidate><label class="field"><span>Nome</span>` +
    `<input id="pf-nome" maxlength="80" autocomplete="off"></label>` +
    `<div class="error" id="pf-msg" role="status"></div><button class="btn" type="submit">Salvar</button></form></div>`;
}

function mountProfile() {
  const p = profileStore.get();
  const photo = document.getElementById('pf-photo');
  const nome = document.getElementById('pf-nome');
  const paint = () => {
    const f = profileStore.get().foto;
    photo.innerHTML = f ? `<img src="${f}" alt="">` : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>';
    setAvatar(f || null);
  };
  nome.value = p.nome || '';
  nome.addEventListener('input', () => {
    const pos = nome.selectionStart, before = nome.value.length;
    nome.value = cleanName(nome.value);
    const q = Math.max(0, pos - (before - nome.value.length));
    nome.setSelectionRange(q, q);
  });
  paint();
  const file = document.getElementById('pf-file');
  document.getElementById('pf-pick').addEventListener('click', () => file.click());
  document.getElementById('pf-remove').addEventListener('click', () => { profileStore.set({ ...profileStore.get(), foto: null }); paint(); });
  file.addEventListener('change', () => {
    const f = file.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => { // recorta em quadrado e reduz para 256px
      const s = Math.min(img.width, img.height), c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      profileStore.set({ ...profileStore.get(), foto: c.toDataURL('image/jpeg', 0.85) });
      URL.revokeObjectURL(img.src);
      paint();
    };
    img.src = URL.createObjectURL(f);
    file.value = '';
  });
  document.getElementById('pf-form').addEventListener('submit', (e) => {
    e.preventDefault();
    profileStore.set({ ...profileStore.get(), nome: cleanName(nome.value, true) });
    nome.value = cleanName(nome.value, true);
    document.getElementById('pf-msg').textContent = 'Perfil salvo.';
  });
}

function refLabel(entity, code) {
  const r = db.all(entity).find((x) => String(x.codigo) === String(code));
  return r ? `${esc(code)} - ${esc(r.nome ?? r.descricao)}` : `${esc(code)}`;
}

function cellHtml(f, row) {
  const v = row[f.key];
  if (f.type === 'status') return v === 'A' ? '<span class="badge on">Ativo</span>' : '<span class="badge off">Inativo</span>';
  if (f.type === 'ref') return refLabel(f.ref, v);
  if (f.type === 'date') return esc(String(v).split('-').reverse().join('/'));
  if (f.type === 'result') return v === 'R' ? '<span class="badge bad">Reprovado</span>' : '<span class="badge on">Aprovado</span>';
  return esc(v);
}

function entityHtml(key) {
  const e = entities[key];
  const rows = db.all(key);
  return `<div class="breadcrumb">${key === 'inspecoes' ? 'Apontamento' : 'Cadastro'}</div><h1>${e.title}</h1>` +
    `<div class="toolbar"><input type="search" id="search" placeholder="Buscar em ${e.title}..." aria-label="Buscar">` +
    `<button class="btn accent" id="new">Novo</button></div>` +
    `<div class="card"><table><thead><tr>${e.fields.map((f) => `<th>${f.label}</th>`).join('')}<th class="actions"></th></tr></thead>` +
    `<tbody id="rows"></tbody></table></div>`;
}

function fillRows(key, term = '') {
  const e = entities[key];
  const t = term.trim().toLowerCase();
  const rows = db.all(key).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));
  const shown = rows.filter((r) => !t || e.fields.some((f) => String(r[f.key]).toLowerCase().includes(t)));
  const body = document.getElementById('rows');
  if (!shown.length) {
    body.innerHTML = `<tr><td class="empty" colspan="${e.fields.length + 1}">Nenhum registro encontrado.</td></tr>`;
    return;
  }
  body.innerHTML = shown.map((r) =>
    `<tr>${e.fields.map((f) => `<td>${cellHtml(f, r)}</td>`).join('')}` +
    `<td class="actions"><button class="link" data-edit="${esc(r.codigo)}">Editar</button>` +
    `<button class="link danger" data-del="${esc(r.codigo)}">Excluir</button></td></tr>`).join('');
}

function openForm(key, row) {
  const e = entities[key];
  const editing = !!row;
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  const inputs = e.fields.map((f) => {
    const id = 'f-' + f.key;
    const val = row ? row[f.key] : '';
    let input;
    if (f.type === 'seq') {
      input = `<input id="${id}" value="${editing ? esc(val) : 'Automático'}" disabled>`;
    } else if (f.type === 'code') {
      input = `<input id="${id}" value="${esc(val)}" maxlength="20" ${editing ? 'disabled' : ''} autocomplete="off">`;
    } else if (f.type === 'status') {
      input = `<select id="${id}"><option value="A"${val !== 'I' ? ' selected' : ''}>Ativo</option><option value="I"${val === 'I' ? ' selected' : ''}>Inativo</option></select>`;
    } else if (f.type === 'date') {
      input = `<input id="${id}" type="date" value="${esc(val || new Date().toLocaleDateString('sv'))}">`;
    } else if (f.type === 'result') {
      input = `<select id="${id}"><option value="A"${val !== 'R' ? ' selected' : ''}>Aprovado</option><option value="R"${val === 'R' ? ' selected' : ''}>Reprovado</option></select>`;
    } else if (f.type === 'ref') {
      input = `<input id="${id}" inputmode="numeric" value="${esc(val)}" autocomplete="off"><small class="hint" id="${id}-hint"></small>`;
    } else {
      input = `<input id="${id}" value="${esc(val)}" maxlength="80" autocomplete="off">`;
    }
    return `<label class="field"><span>${f.label}</span>${input}</label>`;
  }).join('');
  dlg.innerHTML = `<form method="dialog" novalidate><h2>${editing ? 'Editar' : 'Novo'} ${e.singular}</h2>${inputs}` +
    `<div class="error" id="err" role="alert"></div>` +
    `<div class="form-actions"><button type="button" class="btn ghost" id="cancel">Cancelar</button><button class="btn" id="save">Salvar</button></div></form>`;
  document.body.appendChild(dlg);

  const $ = (k) => dlg.querySelector('#f-' + k);
  for (const f of e.fields) {
    const el = $(f.key);
    if (f.type === 'name') {
      el.addEventListener('input', () => { // remove especiais e capitaliza mantendo o cursor
        const pos = el.selectionStart, before = el.value.length;
        el.value = cleanName(el.value);
        const p = Math.max(0, pos - (before - el.value.length));
        el.setSelectionRange(p, p);
      });
    } else if (f.type === 'code') {
      el.addEventListener('input', () => { el.value = el.value.toUpperCase().replace(/[^A-Z0-9._-]/g, ''); });
    } else if (f.type === 'ref') {
      const hint = dlg.querySelector(`#f-${f.key}-hint`);
      const upd = () => {
        el.value = f.alnum ? el.value.toUpperCase().replace(/[^A-Z0-9._-]/g, '') : el.value.replace(/\D/g, '');
        const r = el.value && db.all(f.ref).find((x) => String(x.codigo) === el.value);
        hint.textContent = el.value ? (r ? (r.nome ?? r.descricao) : 'Código não encontrado') : '';
        hint.classList.toggle('bad', !!el.value && !r);
      };
      el.addEventListener('input', upd);
      upd();
    }
  }

  const err = dlg.querySelector('#err');
  dlg.querySelector('#cancel').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => dlg.remove());
  dlg.querySelector('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const data = {};
    for (const f of e.fields) {
      if (f.type === 'seq') continue;
      let v = $(f.key).value;
      if (f.type === 'name') v = cleanName(v, true);
      if (f.type === 'code') v = v.trim().toUpperCase();
      if (f.type === 'ref') v = v.trim();
      if (!v) { err.textContent = `Informe ${f.label.toLowerCase()}.`; return; }
      if (f.type === 'ref' && !db.all(f.ref).some((x) => String(x.codigo) === v)) {
        err.textContent = `${f.label}: código ${v} não existe.`; return;
      }
      data[f.key] = v;
    }
    const rows = db.all(key);
    if (editing) {
      const i = rows.findIndex((r) => String(r.codigo) === String(row.codigo));
      rows[i] = { ...rows[i], ...data };
    } else {
      if (e.fields.some((f) => f.type === 'seq')) data.codigo = db.nextSeq(key);
      else if (rows.some((r) => r.codigo === data.codigo)) { err.textContent = `Já existe ${e.singular} com o código ${data.codigo}.`; return; }
      rows.push(data);
    }
    db.save(key, rows);
    dlg.close();
    fillRows(key, document.getElementById('search')?.value || '');
  });
  dlg.showModal();
  const first = dlg.querySelector('input:not([disabled]), select');
  if (first) first.focus();
}

function deleteRow(key, code) {
  const e = entities[key];
  for (const [other, field] of usedBy[key] || []) {
    if (db.all(other).some((r) => String(r[field]) === String(code))) {
      alert(`Não é possível excluir: ${e.singular} ${code} está em uso em ${entities[other].title}.`);
      return;
    }
  }
  if (!confirm(`Excluir ${e.singular} ${code}?`)) return;
  db.save(key, db.all(key).filter((r) => String(r.codigo) !== String(code)));
  fillRows(key, document.getElementById('search')?.value || '');
}

function mountEntity(key) {
  fillRows(key);
  document.getElementById('search').addEventListener('input', (ev) => fillRows(key, ev.target.value));
  document.getElementById('new').addEventListener('click', () => openForm(key));
  document.getElementById('rows').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.edit) openForm(key, db.all(key).find((r) => String(r.codigo) === b.dataset.edit));
    if (b.dataset.del) deleteRow(key, b.dataset.del);
  });
}

// ---------- Dashboard: Não Conformidades ----------
// Lê db.all('inspecoes'): { data: 'AAAA-MM-DD', colaborador, peca, posto (códigos), resultado: 'A' | 'R' }
const fmtPct = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

function gaugeSvg(pct) {
  const a = Math.PI * (1 - pct / 100), cx = 110, cy = 100, r = 80;
  const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  const arc = (x2, y2, color) => `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 220 125" class="gauge" role="img" aria-label="Reprovação ${fmtPct(pct)}">` +
    `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#E1E8F0" stroke-width="18" stroke-linecap="round"/>` +
    (pct > 0 ? arc(x, y, pct > 10 ? '#C0392B' : '#00B8CC') : '') +
    `<text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="26" font-weight="700" fill="#063663">${fmtPct(pct)}</text>` +
    `<text x="${cx - r}" y="118" text-anchor="middle" font-size="10" fill="#5B7089">0%</text>` +
    `<text x="${cx + r}" y="118" text-anchor="middle" font-size="10" fill="#5B7089">100%</text></svg>`;
}

function lineSvg(points) { // points: [[label, value]]
  const W = 640, H = 220, L = 36, B = 28, T = 12, R = 12;
  const max = Math.max(1, ...points.map((p) => p[1]));
  const step = points.length > 1 ? (W - L - R) / (points.length - 1) : 0;
  const px = (i) => points.length > 1 ? L + i * step : (W + L - R) / 2;
  const py = (v) => T + (H - T - B) * (1 - v / max);
  const every = Math.ceil(points.length / 8);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Reprovações por data">` +
    [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${py(max * f)}" y2="${py(max * f)}" stroke="#E1E8F0"/><text x="${L - 6}" y="${py(max * f) + 4}" text-anchor="end" font-size="10" fill="#5B7089">${Math.round(max * f)}</text>`).join('') +
    `<polyline fill="none" stroke="#083F78" stroke-width="2.5" points="${points.map((p, i) => `${px(i)},${py(p[1])}`).join(' ')}"/>` +
    points.map((p, i) => `<circle cx="${px(i)}" cy="${py(p[1])}" r="4" fill="#03D9EE" stroke="#083F78" stroke-width="2"><title>${esc(p[0])}: ${p[1]}</title></circle>` +
      (i % every === 0 ? `<text x="${px(i)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#5B7089">${esc(p[0])}</text>` : '')).join('') + '</svg>';
}

function barsHtml(title, items) { // items: [[nome, reprovadas]]
  const top = items.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
  const max = Math.max(1, ...top.map((i) => i[1]));
  return `<div class="card"><h3>${title}</h3>` + (top.length
    ? top.map(([n, v]) => `<div class="bar-row"><span class="bar-name" title="${esc(n)}">${esc(n)}</span><div class="bar-track"><div class="bar-fill" style="width:${(v / max) * 100}%"></div></div><b>${v}</b></div>`).join('')
    : '<div class="empty">Sem reprovações.</div>') + '</div>';
}

function dashboardHtml() {
  const rows = db.all('inspecoes');
  const rej = rows.filter((r) => r.resultado === 'R');
  const total = rows.length, rep = rej.length, apr = total - rep;
  const name = (list, code, f = 'nome') => (db.all(list).find((x) => String(x.codigo) === String(code)) || {})[f] || `#${code}`;
  const count = (keyFn) => {
    const m = new Map();
    for (const r of rej) { const k = keyFn(r); if (k != null) m.set(k, (m.get(k) || 0) + 1); }
    return [...m];
  };
  const peca = (r) => db.all('pecas').find((p) => String(p.codigo) === String(r.peca));
  const byDate = count((r) => r.data).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, v]) => [d.split('-').reverse().slice(0, 2).join('/'), v]);
  const kpi = (label, v, cls = '') => `<div class="card kpi ${cls}"><span>${label}</span><b>${v}</b></div>`;
  return `<div class="breadcrumb">Análise › Dashboard</div><h1>Não Conformidades</h1>` +
    `<div class="kpis">${kpi('Inspecionados', total)}${kpi('Aprovados', apr, 'ok')}${kpi('Reprovados', rep, 'bad')}</div>` +
    `<div class="dash-top"><div class="card"><h3>Reprovações por data</h3>${byDate.length ? lineSvg(byDate) : '<div class="empty">Sem reprovações.</div>'}</div>` +
    `<div class="card gauge-card"><h3>Índice de reprovação</h3>${gaugeSvg(total ? (rep / total) * 100 : 0)}</div></div>` +
    `<div class="dash-bars">` +
    barsHtml('Colaboradores', count((r) => name('colaboradores', r.colaborador))) +
    barsHtml('Montadoras', count((r) => { const p = peca(r); return p ? name('montadoras', p.montadora) : null; })) +
    barsHtml('Peças', count((r) => { const p = peca(r); return p ? `${p.codigo} - ${p.descricao}` : `#${r.peca}`; })) +
    barsHtml('Postos de trabalho', count((r) => name('postos', r.posto, 'descricao'))) +
    barsHtml('Projetos', count((r) => { const p = peca(r); return p ? name('projetos', p.projeto) : null; })) +
    `</div>`;
}

function placeholderHtml(s) {
  const head = `<div class="breadcrumb">${s.path}</div><h1>${s.title}</h1>`;
  if (s.dashboard) return dashboardHtml();
  return head +
    `<div class="toolbar"><input type="search" placeholder="Buscar em ${s.title}..." aria-label="Buscar">` +
    `<button class="btn accent">Novo apontamento</button></div>` +
    `<div class="card"><table><thead><tr>${s.cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>` +
    `<tbody><tr><td class="empty" colspan="${s.cols.length}">Nenhum registro encontrado.</td></tr></tbody></table></div>`;
}

// ---------- Abas ----------
const view = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
const HOME = { route: '/', title: 'Início' };
let tabs = [HOME];
let active = HOME.route;

function render() {
  tabsEl.innerHTML = '';
  for (const t of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (t.route === active ? ' active' : '');
    el.setAttribute('role', 'tab');
    el.title = t.title;
    el.tabIndex = 0;
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = t.title;
    el.appendChild(label);
    el.addEventListener('click', () => activate(t.route));
    if (t.route !== HOME.route) { // "Início" é fixa e não pode ser fechada
      const x = document.createElement('button');
      x.className = 'close';
      x.textContent = '×';
      x.title = 'Fechar aba';
      x.addEventListener('click', (e) => { e.stopPropagation(); closeTab(t.route); });
      el.appendChild(x);
    }
    tabsEl.appendChild(el);
  }
  markCurrent();
  const s = screens[active];
  if (!s) view.innerHTML = '<h1>Bem-vindo ao Souzant ERP</h1>';
  else if (s.entity) { view.innerHTML = entityHtml(s.entity); mountEntity(s.entity); }
  else if (s.profile) { view.innerHTML = profileHtml(); mountProfile(); }
  else view.innerHTML = placeholderHtml(s);
}

// Destaca o item do menu da tela ativa e, na barra lateral, abre os grupos que o contêm
function markCurrent() {
  document.querySelectorAll('.menu a').forEach((a) => {
    const on = a.getAttribute('href').slice(1) === active;
    a.classList.toggle('current', on);
    if (on) for (let li = a.closest('li.has-sub'); li; li = li.parentElement.closest('li.has-sub')) li.classList.add('open');
  });
}

function activate(route) { active = route; render(); }

function openTab(route) {
  if (route !== HOME.route && !tabs.some((t) => t.route === route)) {
    tabs.push({ route, title: screens[route].title });
  }
  activate(route);
}

function closeTab(route) {
  const i = tabs.findIndex((t) => t.route === route);
  if (i <= 0) return;
  tabs.splice(i, 1);
  if (active === route) active = tabs[Math.min(i, tabs.length - 1)].route;
  render();
}

// Ctrl+PageDown / Ctrl+PageUp: próxima / anterior aba (circular), como no Chrome
document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
  if (e.key !== 'PageDown' && e.key !== 'PageUp') return;
  e.preventDefault();
  if (tabs.length < 2) return;
  const i = tabs.findIndex((t) => t.route === active);
  const step = e.key === 'PageDown' ? 1 : -1;
  activate(tabs[(i + step + tabs.length) % tabs.length].route);
});

// Barra lateral: clicar num grupo expande/recolhe (acordeão entre irmãos)
function toggleGroup(li) {
  const open = !li.classList.contains('open');
  li.parentElement.querySelectorAll(':scope > li.open').forEach((x) => x.classList.remove('open'));
  li.classList.toggle('open', open);
}
document.querySelector('.menu').addEventListener('click', (e) => {
  const grp = e.target.closest('li.has-sub > span');
  if (grp && document.getElementById('side').contains(grp)) { toggleGroup(grp.parentElement); return; }
});
document.querySelector('.menu').addEventListener('keydown', (e) => {
  const grp = e.target.closest && e.target.closest('li.has-sub > span');
  if ((e.key === 'Enter' || e.key === ' ') && grp && document.getElementById('side').contains(grp)) { e.preventDefault(); toggleGroup(grp.parentElement); }
});

// Links do menu abrem (ou ativam) uma aba
document.querySelector('.menu').addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (!a) return;
  e.preventDefault();
  a.blur();
  openTab(a.getAttribute('href').slice(1));
});
document.getElementById('home-link').addEventListener('click', (e) => { e.preventDefault(); openTab(HOME.route); });

// ---------- Menu do avatar e layout (superior/lateral) ----------
const avatarBtn = document.getElementById('avatar');
const profileMenu = document.getElementById('profile-menu');
const layoutBtn = document.getElementById('menu-layout');
const menuNav = document.querySelector('.menu');
const sideEl = document.getElementById('side');
const logoLink = document.querySelector('.logo-link');

function toggleProfileMenu(open) {
  profileMenu.hidden = !open;
  avatarBtn.setAttribute('aria-expanded', String(open));
}

function applyLayout(mode) {
  const side = mode === 'side';
  const topbar = document.querySelector('.topbar');
  const profile = document.querySelector('.profile');
  if (side) { // logo no topo da lateral, menu no meio, avatar no rodapé
    sideEl.append(logoLink, menuNav, profile);
  } else {
    topbar.append(logoLink, menuNav, profile);
  }
  sideEl.hidden = !side;
  document.body.classList.toggle('side-mode', side);
  layoutBtn.textContent = side ? 'Menu superior' : 'Menu lateral';
  if (typeof markCurrent === 'function') markCurrent();
  try { localStorage.setItem('souzant:layout', mode); } catch { /* sem armazenamento */ }
}

avatarBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleProfileMenu(profileMenu.hidden); });
document.addEventListener('click', (e) => { if (!profileMenu.contains(e.target)) toggleProfileMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleProfileMenu(false); });
document.getElementById('menu-profile').addEventListener('click', () => { toggleProfileMenu(false); openTab('/perfil'); });
layoutBtn.addEventListener('click', () => { toggleProfileMenu(false); applyLayout(sideEl.hidden ? 'side' : 'top'); });

let savedLayout = 'top';
try { savedLayout = localStorage.getItem('souzant:layout') || 'top'; } catch { /* padrão */ }
applyLayout(savedLayout);
render();
