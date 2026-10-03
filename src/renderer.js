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
  defeitos: {
    title: 'Defeitos', singular: 'defeito',
    fields: [
      { key: 'codigo', label: 'Código', type: 'seq' },
      { key: 'defeito', label: 'Defeito', type: 'name' }
    ]
  },
  inspecoes: {
    title: 'Inspeções/Reprovas', singular: 'inspeção',
    fields: [
      { key: 'codigo', label: 'Código', type: 'seq', hideCol: true },
      { key: 'data', label: 'Data', type: 'date' },
      { key: 'peca', label: 'Peça', type: 'ref', ref: 'pecas' },
      { key: 'posto', label: 'Posto de Trabalho', type: 'ref', ref: 'postos' },
      { key: 'colaborador', label: 'Colaborador', type: 'ref', ref: 'colaboradores' },
      { key: 'qtdInspecionada', label: 'Qtde Inspecionada', type: 'int' },
      { key: 'reprovas', label: 'Qtde Reprovada', type: 'reprovas' }
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
  colaboradores: [['inspecoes', 'colaborador']],
  defeitos: [['inspecoes', 'reprovas.defeito']]
};

// ---------- Telas ----------
const screens = {
  '/analise/dashboard/nao-conformidades': { path: 'Análise › Dashboard', title: 'Não Conformidades', dashboard: true },
  '/apontamento/inspecoes-reprovas': { path: 'Apontamento', title: 'Inspeções/Reprovas', entity: 'inspecoes' },
  '/cadastro/defeitos': { path: 'Cadastro', title: 'Defeitos', entity: 'defeitos' },
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
    document.getElementById('pf-msg').textContent = '';
    toast('Perfil salvo.');
  });
}

const recName = (r) => r.nome ?? r.descricao ?? r.defeito ?? '';
const recLabel = (r) => `${r.codigo} - ${recName(r)}`;
const findRec = (entity, code) => db.all(entity).find((x) => String(x.codigo) === String(code));

// Resolve o texto do autocomplete ("1 - Nome", só o código ou só o nome) para um registro
function resolveRef(entity, text) {
  const t = String(text).trim().toLowerCase();
  if (!t) return null;
  return db.all(entity).find((x) => recLabel(x).toLowerCase() === t || String(x.codigo).toLowerCase() === t || recName(x).toLowerCase() === t) || null;
}

const datalistHtml = (id, entity) =>
  `<datalist id="${id}">${db.all(entity).map((x) => `<option value="${esc(recLabel(x))}"></option>`).join('')}</datalist>`;

const rejOf = (r) => Array.isArray(r.reprovas) ? r.reprovas.reduce((a, x) => a + (Number(x.qtd) || 0), 0) : (r.resultado === 'R' ? 1 : 0);
const inspOf = (r) => Number(r.qtdInspecionada ?? 1);

function refLabel(entity, code) {
  const r = findRec(entity, code);
  return r ? esc(recLabel(r)) : esc(code);
}

function cellHtml(f, row) {
  const v = row[f.key];
  if (f.type === 'status') return v === 'A' ? '<span class="badge on">Ativo</span>' : '<span class="badge off">Inativo</span>';
  if (f.type === 'ref') return refLabel(f.ref, v);
  if (f.type === 'date') return esc(String(v).split('-').reverse().join('/'));
  if (f.type === 'int') return esc(inspOf(row));
  if (f.type === 'reprovas') return esc(rejOf(row));
  return esc(v);
}

// Texto usado na busca da lista (o que o usuário vê na célula)
function cellText(f, row) {
  const d = document.createElement('div');
  d.innerHTML = cellHtml(f, row);
  return d.textContent;
}

// Editor de reprovas (defeito + quantidade) dentro do pop-up da inspeção
function repRowHtml(r = {}) {
  const d = r.defeito != null && r.defeito !== '' ? findRec('defeitos', r.defeito) : null;
  return `<div class="rep-row"><input class="rep-def" list="dl-defeitos" placeholder="Defeito" value="${esc(d ? recLabel(d) : '')}" autocomplete="off">` +
    `<input class="rep-qtd" type="number" min="1" step="1" placeholder="Qtde" value="${esc(r.qtd ?? '')}">` +
    `<button type="button" class="link danger rep-del" title="Remover">×</button></div>`;
}

// ---------- Feedback (toast e confirmação) ----------
function toast(msg, kind = 'ok') {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, 2800);
}

function askDialog(msg, { ok = 'OK', cancel = false, danger = false } = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal small';
    dlg.innerHTML = `<form method="dialog"><p class="ask">${esc(msg)}</p><div class="form-actions">` +
      (cancel ? '<button type="button" class="btn ghost" data-r="0">Cancelar</button>' : '') +
      `<button type="button" class="btn${danger ? ' danger' : ''}" data-r="1">${esc(ok)}</button></div></form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { dlg._r = b.dataset.r === '1'; dlg.close(); } });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(!!dlg._r); });
    dlg.showModal();
  });
}

// ---------- Listas ----------
const cols = (e) => e.fields.filter((f) => !f.hideCol);
const hasStatus = (e) => e.fields.some((f) => f.type === 'status');
const entState = {};
const listState = (key) => entState[key] ||= { sort: key === 'inspecoes' ? 'data' : 'codigo', dir: key === 'inspecoes' ? -1 : 1, status: 'all', open: new Set() };
const ICO = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/></svg>',
  del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg>'
};

function entityHtml(key) {
  const e = entities[key], s = listState(key);
  const seg = hasStatus(e)
    ? `<div class="seg" role="group" aria-label="Situação">${[['all', 'Todos'], ['A', 'Ativos'], ['I', 'Inativos']].map(([v, t]) => `<button type="button" data-status="${v}" class="${s.status === v ? 'on' : ''}">${t}</button>`).join('')}</div>` : '';
  return `<div class="breadcrumb">${key === 'inspecoes' ? 'Apontamento' : 'Cadastro'}</div><h1>${e.title}</h1>` +
    `<div class="toolbar"><label class="search">${ICO.search}<input type="search" id="search" placeholder="Buscar em ${e.title}..." aria-label="Buscar"></label>` +
    `${seg}<span class="count" id="count"></span><button class="btn accent" id="new">+ Novo</button></div>` +
    `<div class="card table-card"><table><thead><tr>${cols(e).map((f) => `<th data-sort="${f.key}" tabindex="0">${f.label}<i class="arrow"></i></th>`).join('')}<th class="actions"></th></tr></thead>` +
    `<tbody id="rows"></tbody></table></div>`;
}

function sortVal(f, r) {
  if (f.type === 'seq') return Number(r.codigo) || 0;
  if (f.type === 'int') return inspOf(r);
  if (f.type === 'reprovas') return rejOf(r);
  if (f.type === 'date') return String(r[f.key]);
  return cellText(f, r).toLowerCase();
}

function refresh(key) { fillRows(key, document.getElementById('search')?.value || ''); }

function fillRows(key, term = '') {
  const e = entities[key], s = listState(key);
  const t = term.trim().toLowerCase();
  const all = db.all(key);
  const sf = e.fields.find((f) => f.key === s.sort) || e.fields[0];
  const shown = all
    .filter((r) => s.status === 'all' || r.situacao === s.status)
    .filter((r) => !t || e.fields.some((f) => cellText(f, r).toLowerCase().includes(t)))
    .sort((a, b) => {
      const va = sortVal(sf, a), vb = sortVal(sf, b);
      return s.dir * (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }));
    });
  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.classList.toggle('sorted', th.dataset.sort === s.sort);
    th.dataset.dir = th.dataset.sort === s.sort ? (s.dir > 0 ? 'asc' : 'desc') : '';
  });
  document.getElementById('count').textContent = shown.length === all.length ? `${all.length} registro${all.length === 1 ? '' : 's'}` : `${shown.length} de ${all.length} registros`;
  const body = document.getElementById('rows');
  const span = cols(e).length + 1;
  if (!shown.length) {
    body.innerHTML = `<tr><td class="empty" colspan="${span}"><div class="empty-ico">${ICO.search}</div>${all.length ? 'Nenhum registro encontrado para os filtros.' : 'Nenhum registro ainda. Clique em “+ Novo” para começar.'}</td></tr>`;
    return;
  }
  const expandable = key === 'inspecoes';
  body.innerHTML = shown.map((r) => {
    const open = expandable && s.open.has(String(r.codigo));
    let detail = '';
    if (open) {
      const reps = Array.isArray(r.reprovas) ? r.reprovas : [];
      const ins = inspOf(r), rj = rejOf(r);
      detail = `<tr class="detail"><td colspan="${span}"><div class="detail-box">` +
        (reps.length ? reps.map((x) => `<span class="chip">${esc(recName(findRec('defeitos', x.defeito) || { nome: '#' + x.defeito }))} × ${esc(x.qtd)}</span>`).join('') : '<span class="muted">Sem reprovas nesta inspeção.</span>') +
        `<span class="detail-pct">Reprovação: <b>${fmtPct(ins ? (rj / ins) * 100 : 0)}</b></span></div></td></tr>`;
    }
    return `<tr${expandable ? ` class="exp${open ? ' open' : ''}" data-open="${esc(r.codigo)}"` : ''}>` +
      cols(e).map((f, i) => `<td>${expandable && i === 0 ? '<i class="chev"></i>' : ''}${cellHtml(f, r)}</td>`).join('') +
      `<td class="actions"><button class="icon-btn" data-edit="${esc(r.codigo)}" title="Editar" aria-label="Editar">${ICO.edit}</button>` +
      `<button class="icon-btn danger" data-del="${esc(r.codigo)}" title="Excluir" aria-label="Excluir">${ICO.del}</button></td></tr>` + detail;
  }).join('');
}

function openForm(key, row) {
  const e = entities[key];
  const editing = !!row;
  const dlg = document.createElement('dialog');
  dlg.className = 'modal' + (key === 'inspecoes' ? ' wide' : '');
  const inputs = e.fields.map((f) => {
    const id = 'f-' + f.key;
    const val = row ? row[f.key] : '';
    let input;
    if (f.type === 'reprovas') {
      const reps = row && Array.isArray(row.reprovas) ? row.reprovas : [];
      return `<div class="field"><span>Reprovas</span><div id="${id}">${reps.map(repRowHtml).join('')}</div>` +
        `<button type="button" class="btn ghost small" id="rep-add">+ Adicionar reprova</button>${datalistHtml('dl-defeitos', 'defeitos')}</div>`;
    }
    if (f.type === 'seq') {
      input = `<input id="${id}" value="${editing ? esc(val) : 'Automático'}" disabled>`;
    } else if (f.type === 'code') {
      input = `<input id="${id}" value="${esc(val)}" maxlength="20" ${editing ? 'disabled' : ''} autocomplete="off">`;
    } else if (f.type === 'status') {
      input = `<select id="${id}"><option value="A"${val !== 'I' ? ' selected' : ''}>Ativo</option><option value="I"${val === 'I' ? ' selected' : ''}>Inativo</option></select>`;
    } else if (f.type === 'date') {
      input = `<input id="${id}" type="date" value="${esc(val || new Date().toLocaleDateString('sv'))}">`;
    } else if (f.type === 'int') {
      input = `<input id="${id}" type="number" min="1" step="1" value="${esc(row ? inspOf(row) : '')}">`;
    } else if (f.type === 'ref') {
      const cur = val !== '' ? findRec(f.ref, val) : null;
      input = `<input id="${id}" list="dl-${f.key}" value="${esc(cur ? recLabel(cur) : val)}" autocomplete="off" placeholder="Digite para buscar">${datalistHtml('dl-' + f.key, f.ref)}<small class="hint" id="${id}-hint"></small>`;
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
        const r = resolveRef(f.ref, el.value);
        hint.textContent = el.value.trim() && !r ? 'Selecione um registro da lista' : '';
        hint.classList.toggle('bad', !!hint.textContent);
      };
      el.addEventListener('input', upd);
      upd();
    } else if (f.type === 'reprovas') {
      const box = $(f.key);
      dlg.querySelector('#rep-add').addEventListener('click', () => {
        box.insertAdjacentHTML('beforeend', repRowHtml());
        box.lastElementChild.querySelector('input').focus();
      });
      box.addEventListener('click', (ev) => { if (ev.target.closest('.rep-del')) ev.target.closest('.rep-row').remove(); });
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
      if (f.type === 'reprovas') {
        const list = [];
        for (const rr of $(f.key).querySelectorAll('.rep-row')) {
          const d = resolveRef('defeitos', rr.querySelector('.rep-def').value);
          const q = Number(rr.querySelector('.rep-qtd').value);
          if (!d) { err.textContent = 'Reprovas: selecione um defeito da lista.'; return; }
          if (!Number.isInteger(q) || q < 1) { err.textContent = 'Reprovas: informe a quantidade reprovada.'; return; }
          list.push({ defeito: String(d.codigo), qtd: q });
        }
        data.reprovas = list;
        continue;
      }
      let v = $(f.key).value;
      if (f.type === 'name') v = cleanName(v, true);
      if (f.type === 'code') v = v.trim().toUpperCase();
      if (!v.trim()) { err.textContent = `Informe ${f.label.toLowerCase()}.`; return; }
      if (f.type === 'ref') {
        const r = resolveRef(f.ref, v);
        if (!r) { err.textContent = `${f.label}: selecione um registro da lista.`; return; }
        v = String(r.codigo);
      }
      if (f.type === 'int') {
        v = Number(v);
        if (!Number.isInteger(v) || v < 1) { err.textContent = `${f.label}: informe um número inteiro maior que zero.`; return; }
      }
      data[f.key] = v;
    }
    if (data.reprovas && data.reprovas.reduce((a, x) => a + x.qtd, 0) > data.qtdInspecionada) {
      err.textContent = 'A quantidade reprovada não pode ser maior que a inspecionada.'; return;
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
    refresh(key);
    toast(editing ? 'Registro atualizado.' : 'Registro criado.');
  });
  dlg.showModal();
  const first = dlg.querySelector('input:not([disabled]), select');
  if (first) first.focus();
}

async function deleteRow(key, code) {
  const e = entities[key];
  for (const [other, field] of usedBy[key] || []) {
    const [f1, f2] = field.split('.');
    const uses = (r) => f2 ? (r[f1] || []).some((x) => String(x[f2]) === String(code)) : String(r[f1]) === String(code);
    if (db.all(other).some(uses)) {
      await askDialog(`Não é possível excluir: ${e.singular} ${code} está em uso em ${entities[other].title}.`);
      return;
    }
  }
  if (!await askDialog(`Excluir ${e.singular} ${code}?`, { ok: 'Excluir', cancel: true, danger: true })) return;
  db.save(key, db.all(key).filter((r) => String(r.codigo) !== String(code)));
  refresh(key);
  toast('Registro excluído.');
}

function mountEntity(key) {
  const s = listState(key);
  fillRows(key);
  document.getElementById('search').addEventListener('input', (ev) => fillRows(key, ev.target.value));
  document.getElementById('new').addEventListener('click', () => openForm(key));
  const sortBy = (th) => {
    if (s.sort === th.dataset.sort) s.dir = -s.dir; else { s.sort = th.dataset.sort; s.dir = 1; }
    refresh(key);
  };
  const head = document.querySelector('thead');
  head.addEventListener('click', (ev) => { const th = ev.target.closest('th[data-sort]'); if (th) sortBy(th); });
  head.addEventListener('keydown', (ev) => { const th = ev.target.closest('th[data-sort]'); if (th && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); sortBy(th); } });
  document.querySelector('.toolbar').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-status]');
    if (!b) return;
    s.status = b.dataset.status;
    document.querySelectorAll('[data-status]').forEach((x) => x.classList.toggle('on', x === b));
    refresh(key);
  });
  document.getElementById('rows').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (b) {
      if (b.dataset.edit) openForm(key, db.all(key).find((r) => String(r.codigo) === b.dataset.edit));
      if (b.dataset.del) deleteRow(key, b.dataset.del);
      return;
    }
    const tr = ev.target.closest('tr[data-open]');
    if (tr) { const c = tr.dataset.open; s.open.has(c) ? s.open.delete(c) : s.open.add(c); refresh(key); }
  });
}

// ---------- Início ----------
function homeHtml() {
  const insp = db.all('inspecoes');
  const total = insp.reduce((a, r) => a + inspOf(r), 0), rej = insp.reduce((a, r) => a + rejOf(r), 0);
  const nome = (profileStore.get().nome || '').split(' ')[0];
  const kpi = (label, v, cls, sub) => `<div class="card kpi ${cls}"><div><span>${label}</span><b>${v}</b><small>${sub}</small></div></div>`;
  const quick = [
    ['Dashboard', 'Não Conformidades', '/analise/dashboard/nao-conformidades', 'Ver análise'],
    ['Apontamento', 'Inspeções/Reprovas', '/apontamento/inspecoes-reprovas', `${insp.length} registros`],
    ...[['colaboradores', '/cadastro/colaboradores'], ['defeitos', '/cadastro/defeitos'], ['montadoras', '/cadastro/montadoras'], ['pecas', '/cadastro/pecas'], ['postos', '/cadastro/postos-de-trabalho'], ['projetos', '/cadastro/projetos']]
      .map(([k, route]) => ['Cadastro', entities[k].title, route, `${db.all(k).length} registros`])
  ];
  const recent = [...insp].sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.codigo - a.codigo).slice(0, 5);
  const pecaTxt = (c) => { const p = findRec('pecas', c); return p ? `${p.codigo} - ${p.descricao}` : c; };
  return `<div class="breadcrumb">Início</div><h1>${nome ? `Olá, ${esc(nome)}!` : 'Bem-vindo ao Souzant ERP'}</h1>` +
    `<div class="soft"><div class="kpis">${kpi('Inspecionados', total, '', 'total registrado')}${kpi('Reprovados', rej, 'bad', 'total registrado')}${kpi('Índice de reprovação', total ? fmtPct((rej / total) * 100) : '—', 'ok', 'geral')}</div>` +
    `<h3 class="sec">Acesso rápido</h3><div class="quick">${quick.map(([g, t, route, sub]) => `<button type="button" class="card quick-card" data-go="${route}"><small>${g}</small><b>${t}</b><span>${sub}</span></button>`).join('')}</div>` +
    `<div class="card table-card"><h3 class="card-title">Últimas inspeções</h3>` +
    (recent.length ? `<table><thead><tr><th>Data</th><th>Peça</th><th>Qtde Inspecionada</th><th>Qtde Reprovada</th></tr></thead><tbody>${recent.map((r) => `<tr><td>${fmtDate(r.data)}</td><td>${esc(pecaTxt(r.peca))}</td><td>${inspOf(r)}</td><td>${rejOf(r)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhuma inspeção registrada.</div>') +
    `</div></div>`;
}

function mountHome() {
  view.querySelector('.quick').addEventListener('click', (ev) => { const b = ev.target.closest('[data-go]'); if (b) openTab(b.dataset.go); });
}

// ---------- Dashboard: Não Conformidades ----------
// Lê db.all('inspecoes'): { data: 'AAAA-MM-DD', colaborador, peca, posto (códigos), qtdInspecionada, reprovas: [{ defeito, qtd }] }
// Interativo (estilo Power BI): clique num item filtra os demais visuais; Ctrl+clique seleciona vários.
const fmtPct = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
const fmtDate = (iso) => String(iso).split('-').reverse().join('/');

const DIMS = [['colaborador', 'Colaboradores'], ['montadora', 'Montadoras'], ['peca', 'Peças'], ['posto', 'Postos de trabalho'], ['projeto', 'Projetos'], ['defeito', 'Defeitos']];
const dash = { f: { data: new Set(), colaborador: new Set(), montadora: new Set(), peca: new Set(), posto: new Set(), projeto: new Set(), defeito: new Set() }, from: '', to: '', metric: 'qtd', page: {}, win: 'week', linePage: null, lpCur: 0, lw: 0, lh: 0, level: 2, scope: '', drillMode: false, hide: { insp: false, rej: false } };
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// Hierarquia de datas (como no Power BI): 0 = Ano, 1 = Mês, 2 = Dia
const LEVELS = ['Ano', 'Mês', 'Dia'];
const keyAt = (iso, lv) => iso.slice(0, lv === 0 ? 4 : lv === 1 ? 7 : 10);
const fmtKey = (k) => k.length === 4 ? k : k.length === 7 ? `${MONTHS[Number(k.slice(5)) - 1]}/${k.slice(0, 4)}` : fmtDate(k);
const keyLabel = (k) => k.length === 10 ? fmtDate(k).slice(0, 5) : fmtKey(k);
const monthEnd = (ym) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; };
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
const BAR_PAGE = 3;
const dashActive = () => !!(dash.from || dash.to || Object.values(dash.f).some((s) => s.size));

function dashFacts() {
  const nm = (entity, code) => { const x = findRec(entity, code); return x ? recName(x) : `#${code}`; };
  return db.all('inspecoes').map((r) => {
    const p = findRec('pecas', r.peca);
    const defs = {};
    for (const x of Array.isArray(r.reprovas) ? r.reprovas : []) { const n = nm('defeitos', x.defeito); defs[n] = (defs[n] || 0) + (Number(x.qtd) || 0); }
    return {
      data: r.data, insp: inspOf(r), rej: rejOf(r),
      colaborador: nm('colaboradores', r.colaborador),
      posto: nm('postos', r.posto),
      peca: p ? `${p.codigo} - ${p.descricao}` : `#${r.peca}`,
      montadora: p ? nm('montadoras', p.montadora) : '(sem peça)',
      projeto: p ? nm('projetos', p.projeto) : '(sem peça)',
      defs
    };
  });
}

// Linhas visíveis aplicando o período e os filtros de todas as dimensões, menos `except` (o próprio visual continua completo e só destaca a seleção)
// Defeito é multivalorado (uma inspeção pode ter vários): filtra inspeções que o contenham e, nos demais visuais, conta só a qtde desses defeitos
function dashRows(facts, except) {
  const dsel = dash.f.defeito;
  const rows = facts.filter((f) =>
    (!dash.from || f.data >= dash.from) && (!dash.to || f.data <= dash.to) &&
    Object.entries(dash.f).every(([d, set]) => d === except || !set.size || (d === 'defeito' ? [...set].some((x) => f.defs[x]) : d === 'data' ? [...set].some((k) => f.data.startsWith(k)) : set.has(f[d]))));
  return except !== 'defeito' && dsel.size ? rows.map((f) => ({ ...f, rej: [...dsel].reduce((a, x) => a + (f.defs[x] || 0), 0) })) : rows;
}

// Por defeito: qtde reprovada do defeito; o % é sobre o total inspecionado (contribuição para o índice geral)
function defAgg(rows) {
  const m = new Map(), insp = rows.reduce((a, f) => a + f.insp, 0);
  for (const f of rows) for (const [n, q] of Object.entries(f.defs)) {
    const a = m.get(n) || { insp, rej: 0 };
    a.rej += q;
    m.set(n, a);
  }
  return m;
}

function dashAgg(rows, dim) {
  const m = new Map();
  for (const f of rows) {
    const a = m.get(f[dim]) || { insp: 0, rej: 0 };
    a.insp += f.insp; a.rej += f.rej;
    m.set(f[dim], a);
  }
  return m;
}

const dashVal = (a) => dash.metric === 'pct' ? (a.insp ? (a.rej / a.insp) * 100 : 0) : a.rej;
const dashFmt = (v) => dash.metric === 'pct' ? fmtPct(v) : String(v);
const dashTip = (label, a) => `${label}\nReprovadas: ${a.rej}\nInspecionadas: ${a.insp}\nReprovação: ${fmtPct(a.insp ? (a.rej / a.insp) * 100 : 0)}`;

function gaugeSvg(pct) {
  const a = Math.PI * (1 - Math.min(pct, 100) / 100), cx = 110, cy = 100, r = 80;
  const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  const tone = pct > 10 ? ['#FF8A7A', '#E5554B'] : pct > 5 ? ['#FFD27A', '#F2A33A'] : ['#03D9EE', '#0E9F8E'];
  const label = pct > 10 ? 'Atenção' : pct > 5 ? 'Moderado' : 'Dentro da meta';
  return `<svg viewBox="0 0 220 135" class="gauge" role="img" aria-label="Reprovação ${fmtPct(pct)}">` +
    `<defs><linearGradient id="g-arc" gradientUnits="userSpaceOnUse" x1="${cx - r}" y1="0" x2="${cx + r}" y2="0"><stop offset="0" stop-color="${tone[0]}"/><stop offset="1" stop-color="${tone[1]}"/></linearGradient></defs>` +
    `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#EEF3F8" stroke-width="16" stroke-linecap="round"/>` +
    (pct > 0 ? `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}" fill="none" stroke="url(#g-arc)" stroke-width="16" stroke-linecap="round"/>` : '') +
    `<text x="${cx}" y="${cy - 12}" text-anchor="middle" font-size="28" font-weight="700" fill="#063663">${fmtPct(pct)}</text>` +
    `<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="10" font-weight="600" fill="${tone[1]}">${label}</text>` +
    `<text x="${cx - r}" y="125" text-anchor="middle" font-size="9" fill="#8A9BB0">0%</text>` +
    `<text x="${cx + r}" y="125" text-anchor="middle" font-size="9" fill="#8A9BB0">100%</text></svg>`;
}

// Curva suave (Catmull-Rom → Bézier), sem ultrapassar os limites do gráfico
function smoothPath(pts, lo, hi) {
  const cl = (v) => Math.max(lo, Math.min(hi, v));
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.18;
    d += ` C${p1[0] + (p2[0] - p0[0]) * t},${cl(p1[1] + (p2[1] - p0[1]) * t)} ${p2[0] - (p3[0] - p1[0]) * t},${cl(p2[1] - (p3[1] - p1[1]) * t)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const LINE_COLORS = { insp: '#083F78', rej: '#E5554B' };

// Duas linhas (Inspeções e Reprovas, cada uma com seu eixo) ou, na métrica %, uma só com o índice de reprovação.
// Eixo de datas: pontos com `t` (0–1) ficam na posição real do tempo (dia a dia); sem `t`, espaçamento igual (ano/mês).
function lineSvg(points) { // points: [{ key, label, tip, t, a }]
  const labels = points.map((p) => ({ label: p.label, t: p.t }));
  const many = labels.length > 12;
  const W = dash.lw || 640, H = Math.max(170, dash.lh || 250), L = 42, R = 16, T = 26, B = many ? 52 : 32; // W/H = tamanho real do contêiner (o SVG ocupa toda a largura)
  const rate = (a) => a.insp ? (a.rej / a.insp) * 100 : 0;
  const series = (dash.metric === 'pct'
    ? [{ id: 'rej', color: LINE_COLORS.rej, vals: points.map((p) => rate(p.a)), fmt: fmtPct, tick: (v) => Math.round(v) + '%' }]
    : [{ id: 'insp', color: LINE_COLORS.insp, vals: points.map((p) => p.a.insp), fmt: String, tick: (v) => Math.round(v) },
      { id: 'rej', color: LINE_COLORS.rej, vals: points.map((p) => p.a.rej), fmt: String, tick: (v) => Math.round(v) }]
  ).filter((s) => !dash.hide[s.id]);
  // Eixo único para as duas linhas, para que as alturas sejam comparáveis (323 inspeções ficam acima de 20 reprovas)
  const max = Math.max(1, ...series.flatMap((s) => s.vals));
  series.forEach((s) => { s.side = 'L'; s.max = max; });
  const base = H - B, IN = 16;
  const n = points.length;
  const px = (i) => n > 1 && points[i].t != null ? L + IN + points[i].t * (W - L - R - 2 * IN)
    : n > 1 ? L + IN + (i / (n - 1)) * (W - L - R - 2 * IN) : (W + L - R) / 2;
  const py = (v, s) => T + (base - T) * (1 - v / s.max);
  const sel = dash.f.data, any = sel.size > 0;
  const isSel = (k) => [...sel].some((x) => x.startsWith(k) || k.startsWith(x));
  const xs = points.map((p, i) => px(i));
  const colW = Math.max(22, n > 1 ? Math.min(...xs.slice(1).map((x, i) => x - xs[i])) : 22);
  const grid = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${py(series[0].max * f, series[0])}" y2="${py(series[0].max * f, series[0])}" stroke="#E8EEF5" stroke-dasharray="3 5"/>`).join('');
  const axes = [0, 0.5, 1].map((f) => `<text x="${L - 8}" y="${py(max * f, series[0]) + 4}" text-anchor="end" font-size="11" fill="#8A9BB0">${series[0].tick(max * f)}</text>`).join('');
  const lines = n > 1 ? series.map((s, k) => {
    const pts = points.map((p, i) => [xs[i], py(s.vals[i], s)]);
    const d = smoothPath(pts, T, base);
    return (k === 0 ? `<path d="${d} L${xs[n - 1]},${base} L${xs[0]},${base} Z" fill="url(#g-area0)"/>` : '') +
      `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('') : '';
  const defs = `<defs><linearGradient id="g-area0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${series[0].color}" stop-opacity=".18"/><stop offset="1" stop-color="${series[0].color}" stop-opacity="0"/></linearGradient></defs>`;
  const cols = points.map((p, i) => {
    const on = isSel(p.key), x = xs[i];
    const ys = series.map((s) => py(s.vals[i], s));
    const close = series.length > 1 && Math.abs(ys[0] - ys[1]) < 18;
    const upper = ys.length > 1 && ys[0] <= ys[1] ? 0 : 1;
    const marks = series.map((s, k) => {
      const ly = close && k !== upper ? ys[k] + 16 : ys[k] - 9;
      return `<circle cx="${x}" cy="${ys[k]}" r="${on ? 5 : 3.5}" fill="${on ? s.color : '#fff'}" stroke="${s.color}" stroke-width="2.2"/>` +
        `<text x="${x}" y="${ly}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${s.color}">${esc(s.fmt(s.vals[i]))}</text>`;
    }).join('');
    return `<g data-dim="data" data-key="${esc(p.key)}" data-tip="${esc(dashTip(p.tip, p.a))}" class="pt${on ? ' sel' : ''}${any && !on ? ' dim' : ''}" tabindex="0" role="button">` +
      `<rect class="col" x="${x - colW / 2}" y="${T - 14}" width="${colW}" height="${base - T + 14}" fill="${on ? 'rgba(3,217,238,.12)' : 'transparent'}"/>` +
      `<line class="xh" x1="${x}" x2="${x}" y1="${T - 8}" y2="${base}" stroke="#9FB3C8" stroke-dasharray="3 3"/>${marks}</g>`;
  }).join('');
  const xl = labels.map((lb, k) => {
    const x = lb.t != null ? L + IN + lb.t * (W - L - R - 2 * IN) : labels.length > 1 ? L + IN + (k / (labels.length - 1)) * (W - L - R - 2 * IN) : (W + L - R) / 2;
    return many
      ? `<text x="${x}" y="${base + 14}" text-anchor="end" font-size="10.5" fill="#8A9BB0" transform="rotate(-45 ${x} ${base + 14})">${esc(lb.label)}</text>`
      : `<text x="${x}" y="${base + 18}" text-anchor="middle" font-size="11" fill="#8A9BB0">${esc(lb.label)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Inspeções e reprovas por data">${defs}${grid}${axes}${lines}${cols}${xl}</svg>`;
}

function barsHtml(dim, title, facts) {
  const m = dim === 'defeito' ? defAgg(dashRows(facts, dim)) : dashAgg(dashRows(facts, dim), dim), sel = dash.f[dim];
  const all = [...m].filter(([k, a]) => dash.metric === 'pct' ? a.insp > 0 : a.rej > 0 || sel.has(k))
    .sort((x, y) => dashVal(y[1]) - dashVal(x[1]) || x[0].localeCompare(y[0]));
  const pages = Math.max(1, Math.ceil(all.length / BAR_PAGE));
  const page = Math.min(dash.page[dim] || 0, pages - 1);
  dash.page[dim] = page;
  const items = all.slice(page * BAR_PAGE, (page + 1) * BAR_PAGE);
  const max = Math.max(1, ...all.map(([, a]) => dashVal(a)));
  const pager = pages > 1
    ? `<div class="pager"><button type="button" data-page="${dim}" data-d="-1" aria-label="Página anterior"${page === 0 ? ' disabled' : ''}>‹</button><span>${page + 1} / ${pages}</span><button type="button" data-page="${dim}" data-d="1" aria-label="Próxima página"${page === pages - 1 ? ' disabled' : ''}>›</button></div>` : '';
  return `<div class="card"><h3>${title}</h3><div class="bar-list">` + (items.length
    ? items.map(([k, a]) => {
      const on = sel.has(k);
      return `<div class="bar-row${on ? ' sel' : ''}${sel.size && !on ? ' dim' : ''}" data-dim="${dim}" data-key="${esc(k)}" data-tip="${esc(dashTip(k, a))}" tabindex="0" role="button">` +
        `<span class="bar-name">${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${(dashVal(a) / max) * 100}%"></div></div><b>${dashFmt(dashVal(a))}</b></div>`;
    }).join('')
    : '<div class="empty">Sem dados para os filtros atuais.</div>') + '</div>' + pager + '</div>';
}

function dashInner() {
  const facts = dashFacts();
  if (!facts.length) return '<div class="card empty">Nenhuma inspeção registrada para exibir.</div>';
  const dates = facts.map((f) => f.data).sort();
  const rows = dashRows(facts, null);
  const total = rows.reduce((a, f) => a + f.insp, 0), rep = rows.reduce((a, f) => a + f.rej, 0), apr = total - rep;
  const share = (v) => total ? fmtPct((v / total) * 100) : '—';
  const KPI_ICO = {"":"<path d=\"M9 3h6l1 2h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3zM8 12l3 3 5-6\" />","ok":"<path d=\"M5 12l5 5L20 7\" />","bad":"<path d=\"M6 6l12 12M18 6L6 18\" />"};
  const kpi = (label, v, cls, sub) => `<div class="card kpi ${cls}"><i class="kpi-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${KPI_ICO[cls]}</svg></i><div><span>${label}</span><b>${v}</b><small>${sub}</small></div></div>`;
  const grp = new Map();
  for (const f of dashRows(facts, 'data').filter((x) => x.data.startsWith(dash.scope))) {
    const k = keyAt(f.data, dash.level), a = grp.get(k) || { insp: 0, rej: 0 };
    a.insp += f.insp; a.rej += f.rej;
    grp.set(k, a);
  }
  const allPts = [...grp].sort((a, b) => a[0].localeCompare(b[0])).map(([k, a]) => ({ key: k, label: keyLabel(k), tip: fmtKey(k), t: null, a }));
  // Nível Dia sem recorte: janelas de 7 ou 31 dias corridos (abre na mais recente)
  const useWin = dash.level === 2 && dash.scope.length < 7;
  let pts = allPts, linePager = '', winUi = '';
  if (useWin) {
    // Janelas contadas a partir da data mais recente, para a última página ser sempre uma janela completa
    const N = dash.win === 'week' ? 7 : 31, tN = allPts.length ? allPts[allPts.length - 1].key : '';
    const fromEnd = (iso) => Math.floor((Date.parse(tN) - Date.parse(iso)) / 864e5 / N);
    const nPages = allPts.length ? fromEnd(allPts[0].key) + 1 : 1;
    const dIdx = (iso) => nPages - 1 - fromEnd(iso);
    const lp = dash.linePage == null ? nPages - 1 : Math.max(0, Math.min(dash.linePage, nPages - 1));
    dash.lpCur = lp;
    const wEnd = tN ? addDays(tN, -(nPages - 1 - lp) * N) : '', wStart = tN ? addDays(wEnd, -(N - 1)) : '';
    const win = allPts.filter((p) => dIdx(p.key) === lp);
    pts = win; // só dias com inspeção, igualmente espaçados (sem dias em branco)
    linePager = nPages > 1
      ? `<div class="pager"><button type="button" data-lpage="-1" aria-label="Janela anterior"${lp === 0 ? ' disabled' : ''}>‹</button><span>${fmtDate(wStart)} – ${fmtDate(wEnd)}</span><button type="button" data-lpage="1" aria-label="Próxima janela"${lp === nPages - 1 ? ' disabled' : ''}>›</button></div>` : '';
    winUi = `<div class="seg" role="group" aria-label="Intervalo"><button type="button" data-win="week" class="${dash.win === 'week' ? 'on' : ''}">Semanal</button><button type="button" data-win="month" class="${dash.win === 'month' ? 'on' : ''}">Mensal</button></div>`;
  } else if (dash.level === 2 && allPts.length) {
    pts = allPts;
  }
  const drill = `<div class="drill" role="group" aria-label="Hierarquia de datas"><button type="button" data-drill="up" title="Subir um nível"${dash.level === 0 ? ' disabled' : ''}>↑</button>` +
    `<button type="button" data-drill="mode" title="Modo de detalhamento: clique em um ponto para detalhá-lo" class="${dash.drillMode ? 'on' : ''}"${dash.level === 2 ? ' disabled' : ''}>↓</button>` +
    `<button type="button" data-drill="next" title="Ir para o próximo nível"${dash.level === 2 ? ' disabled' : ''}>⇊</button>` +
    `<span class="drill-path">${LEVELS[dash.level]}${dash.scope ? ' · ' + fmtKey(dash.scope) : ''}</span></div>`;
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
  const curMonth = months.find((m) => dash.from === m + '-01' && dash.to === monthEnd(m)) || '';
  const monthSel = `<label>Mês <select id="d-month"><option value="">Todos os meses</option>${months.map((m) => `<option value="${m}"${m === curMonth ? ' selected' : ''}>${MONTHS[Number(m.slice(5)) - 1]}/${m.slice(0, 4)}</option>`).join('')}</select></label>`;
  const chips = [...(dash.from || dash.to ? [['range', `Período: ${dash.from ? fmtDate(dash.from) : '…'} a ${dash.to ? fmtDate(dash.to) : '…'}`]] : []),
    ...[['data', 'Data'], ...DIMS.map(([d, t]) => [d, t])].filter(([d]) => dash.f[d].size)
      .map(([d, t]) => [d, `${t}: ${[...dash.f[d]].map((v) => (d === 'data' ? fmtKey(v) : v)).join(', ')}`])];
  return `<div class="dash-bar">` +
    `${monthSel}<label>De <input type="date" id="d-from" value="${esc(dash.from)}" min="${dates[0]}" max="${dates[dates.length - 1]}"></label>` +
    `<label>até <input type="date" id="d-to" value="${esc(dash.to)}" min="${dates[0]}" max="${dates[dates.length - 1]}"></label>` +
    `<div class="seg" role="group" aria-label="Métrica"><button type="button" data-metric="qtd" class="${dash.metric === 'qtd' ? 'on' : ''}">Qtde reprovada</button>` +
    `<button type="button" data-metric="pct" class="${dash.metric === 'pct' ? 'on' : ''}">% de reprovação</button></div>` +
    (dashActive() ? '<button type="button" class="btn ghost small" data-clear="all">Limpar filtros</button>' : '') +
    `</div>` +
    (chips.length ? `<div class="chips">${chips.map(([d, t]) => `<span class="chip">${esc(t)}<button type="button" data-clear="${d}" aria-label="Remover filtro">×</button></span>`).join('')}</div>` : '') +
    `<div class="kpis">${kpi('Inspecionados', total, '', 'no filtro atual')}${kpi('Aprovados', apr, 'ok', share(apr) + ' do total')}${kpi('Reprovados', rep, 'bad', share(rep) + ' do total')}</div>` +
    `<div class="dash-top"><div class="card"><div class="card-head"><h3>${dash.metric === 'pct' ? '% de reprovação' : 'Inspeções e reprovas'} por data</h3>` +
    `<div class="legend">${dash.metric === 'pct' ? '' : `<button type="button" data-ser="insp" class="${dash.hide.insp ? 'off' : ''}"><i style="background:${LINE_COLORS.insp}"></i>Inspeções</button>`}<button type="button" data-ser="rej" class="${dash.hide.rej ? 'off' : ''}"><i style="background:${LINE_COLORS.rej}"></i>${dash.metric === 'pct' ? '% de reprovação' : 'Reprovas'}</button></div>` +
    `${drill}${winUi}</div>` +
    `<div class="line-box">${pts.length ? lineSvg(pts) : '<div class="empty">Sem dados para os filtros atuais.</div>'}</div>${linePager}</div>` +
    `<div class="card gauge-card"><h3>Índice de reprovação</h3>${gaugeSvg(total ? (rep / total) * 100 : 0)}</div></div>` +
    `<div class="dash-bars">${DIMS.map(([d, t]) => barsHtml(d, t, facts)).join('')}</div>` +
    `<p class="dash-help">Clique em um item para filtrar os demais gráficos. Ctrl+clique seleciona vários; clique de novo para remover.</p>`;
}

function dashboardHtml() {
  const expand = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  return `<div id="dash-wrap"><div class="dash-head"><div class="dash-title"><img class="fs-logo" src="assets/logo.png" alt="Souzant"><div><div class="breadcrumb">Análise › Dashboard</div><h1>Não Conformidades</h1></div></div>` +
    `<button type="button" class="btn ghost fs-btn" id="fs-btn">${expand}<span>${document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'}</span></button></div>` +
    `<div id="dash" class="soft">${dashInner()}</div></div>`;
}

let dashTipEl;
// Em tela cheia só o elemento em fullscreen é exibido: leva o tooltip junto
document.addEventListener('fullscreenchange', () => {
  const fs = document.fullscreenElement, b = document.getElementById('fs-btn');
  if (b) b.querySelector('span').textContent = fs ? 'Sair da tela cheia' : 'Tela cheia';
  if (dashTipEl) { dashTipEl.hidden = true; (fs || document.body).appendChild(dashTipEl); }
});
function mountDashboard() {
  const root = document.getElementById('dash');
  document.getElementById('fs-btn').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.getElementById('dash-wrap').requestFullscreen().catch(() => toast('Não foi possível abrir em tela cheia.', 'err'));
  });
  const update = () => { if (dashTipEl) dashTipEl.hidden = true; root.innerHTML = dashInner(); };
  // Ajusta o gráfico de linha ao tamanho real do contêiner (largura sempre total; altura total em tela cheia)
  const fit = () => {
    const box = root.querySelector('.line-box');
    if (!box) return;
    const w = Math.round(box.clientWidth), h = document.fullscreenElement ? Math.round(box.clientHeight) : 250;
    if (w > 0 && (Math.abs(w - dash.lw) > 1 || Math.abs(h - dash.lh) > 1)) { dash.lw = w; dash.lh = h; update(); }
  };
  new ResizeObserver(() => requestAnimationFrame(fit)).observe(root);
  fit();
  if (!dashTipEl) { dashTipEl = document.createElement('div'); dashTipEl.className = 'dash-tip'; dashTipEl.hidden = true; document.body.appendChild(dashTipEl); }
  const pick = (el, multi) => {
    if (el.dataset.dim === 'data' && dash.drillMode && dash.level < 2) { dash.scope = el.dataset.key; dash.level++; dash.linePage = null; update(); return; }
    const set = dash.f[el.dataset.dim], k = el.dataset.key;
    if (multi) set.has(k) ? set.delete(k) : set.add(k);
    else if (set.size === 1 && set.has(k)) set.clear();
    else { set.clear(); set.add(k); }
    update();
  };
  root.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-dim],[data-metric],[data-clear],[data-page],[data-win],[data-lpage],[data-drill],[data-ser]');
    if (!t) return;
    if (t.dataset.ser) {
      const o = t.dataset.ser === 'insp' ? 'rej' : 'insp';
      if (dash.metric !== 'pct' && !dash.hide[o]) dash.hide[t.dataset.ser] = !dash.hide[t.dataset.ser];
      update(); return;
    }
    if (t.dataset.drill) {
      const d = t.dataset.drill;
      if (d === 'mode') dash.drillMode = !dash.drillMode;
      else if (d === 'up' && dash.level > 0) { dash.level--; dash.scope = dash.scope.length > 4 ? dash.scope.slice(0, 4) : ''; }
      else if (d === 'next' && dash.level < 2) dash.level++;
      dash.linePage = null; update(); return;
    }
    if (t.dataset.win) { dash.win = t.dataset.win; dash.linePage = null; update(); return; }
    if (t.dataset.lpage) { dash.linePage = dash.lpCur + Number(t.dataset.lpage); update(); return; }
    if (t.dataset.page) { dash.page[t.dataset.page] = (dash.page[t.dataset.page] || 0) + Number(t.dataset.d); update(); return; }
    if (t.dataset.metric) { dash.metric = t.dataset.metric; update(); }
    else if (t.dataset.clear) {
      const c = t.dataset.clear;
      dash.linePage = null;
      if (c === 'all') { dash.from = dash.to = ''; Object.values(dash.f).forEach((s) => s.clear()); }
      else if (c === 'range') dash.from = dash.to = '';
      else dash.f[c].clear();
      update();
    } else pick(t, ev.ctrlKey || ev.metaKey);
  });
  root.addEventListener('keydown', (ev) => {
    const t = ev.target.closest('[data-dim]');
    if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); pick(t, ev.ctrlKey || ev.metaKey); }
  });
  root.addEventListener('change', (ev) => {
    dash.linePage = null;
    if (ev.target.id === 'd-month') { const v = ev.target.value; dash.from = v ? v + '-01' : ''; dash.to = v ? monthEnd(v) : ''; update(); return; }
    if (ev.target.id === 'd-from') dash.from = ev.target.value;
    else if (ev.target.id === 'd-to') dash.to = ev.target.value;
    else return;
    if (dash.from && dash.to && dash.from > dash.to) [dash.from, dash.to] = [dash.to, dash.from];
    update();
  });
  root.addEventListener('mousemove', (ev) => {
    const t = ev.target.closest('[data-tip]');
    if (!t) { dashTipEl.hidden = true; return; }
    dashTipEl.textContent = t.dataset.tip;
    dashTipEl.hidden = false;
    const w = dashTipEl.offsetWidth;
    dashTipEl.style.left = Math.min(ev.clientX + 14, window.innerWidth - w - 8) + 'px';
    dashTipEl.style.top = (ev.clientY + 14) + 'px';
  });
  root.addEventListener('mouseleave', () => { dashTipEl.hidden = true; });
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
  if (!s) { view.innerHTML = homeHtml(); mountHome(); }
  else if (s.entity) { view.innerHTML = entityHtml(s.entity); mountEntity(s.entity); }
  else if (s.profile) { view.innerHTML = profileHtml(); mountProfile(); }
  else { view.innerHTML = placeholderHtml(s); if (s.dashboard) mountDashboard(); }
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
