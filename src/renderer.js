// Define a foto do usuário no avatar (URL ou data URI); sem foto mostra o ícone padrão.
function setAvatar(url) {
  const img = document.getElementById('avatar-img');
  const fallback = document.getElementById('avatar-fallback');
  if (url) { img.src = url; img.hidden = false; fallback.style.display = 'none'; }
  else { img.hidden = true; fallback.style.display = ''; }
}
window.setAvatar = setAvatar;
setAvatar(null);

// Telas: rota -> trilha do menu, título e colunas da listagem
const screens = {
  '/analise/dashboard/nao-conformidades': { path: 'Análise › Dashboard', title: 'Não Conformidades', dashboard: true },
  '/apontamento/inspecoes-reprovas': { path: 'Apontamento', title: 'Inspeções/Reprovas', cols: ['Data', 'Peça', 'Posto', 'Inspetor', 'Resultado'] },
  '/cadastro/colaboradores': { path: 'Cadastro', title: 'Colaboradores', cols: ['Nome', 'Matrícula', 'Função', 'Situação'] },
  '/cadastro/montadoras': { path: 'Cadastro', title: 'Montadoras', cols: ['Nome', 'País', 'Situação'] },
  '/cadastro/pecas': { path: 'Cadastro', title: 'Peças', cols: ['Código', 'Descrição', 'Projeto', 'Situação'] },
  '/cadastro/postos-de-trabalho': { path: 'Cadastro', title: 'Postos de trabalho', cols: ['Código', 'Descrição', 'Setor', 'Situação'] },
  '/cadastro/projetos': { path: 'Cadastro', title: 'Projetos', cols: ['Código', 'Nome', 'Montadora', 'Situação'] }
};

const view = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
const HOME = { route: '/', title: 'Início' };
let tabs = [HOME];
let active = HOME.route;

function screenHtml(route) {
  const s = screens[route];
  if (!s) return '<h1>Bem-vindo ao Souzant ERP</h1>';
  const head = `<div class="breadcrumb">${s.path}</div><h1>${s.title}</h1>`;
  if (s.dashboard) return head + '<div class="card empty">Nenhum dado de não conformidades para exibir.</div>';
  const isCadastro = s.path === 'Cadastro';
  return head +
    `<div class="toolbar"><input type="search" placeholder="Buscar em ${s.title}..." aria-label="Buscar">` +
    `<button class="btn accent">${isCadastro ? 'Novo' : 'Novo apontamento'}</button></div>` +
    `<div class="card"><table><thead><tr>${s.cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>` +
    `<tbody><tr><td class="empty" colspan="${s.cols.length}">Nenhum registro encontrado.</td></tr></tbody></table></div>`;
}

function render() {
  tabsEl.innerHTML = '';
  for (const t of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (t.route === active ? ' active' : '');
    el.setAttribute('role', 'tab');
    el.tabIndex = 0;
    el.textContent = t.title;
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
  view.innerHTML = screenHtml(active);
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

// Links do menu abrem (ou ativam) uma aba
document.querySelector('.menu').addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (!a) return;
  e.preventDefault();
  a.blur();
  openTab(a.getAttribute('href').slice(1));
});
document.getElementById('home-link').addEventListener('click', (e) => { e.preventDefault(); openTab(HOME.route); });
render();
