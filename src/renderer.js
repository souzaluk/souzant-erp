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

function render() {
  const route = location.hash.replace(/^#/, '') || '/';
  const s = screens[route];
  if (!s) { view.innerHTML = '<h1>Bem-vindo ao Souzant ERP</h1>'; return; }
  const head = `<div class="breadcrumb">${s.path}</div><h1>${s.title}</h1>`;
  if (s.dashboard) {
    view.innerHTML = head + '<div class="card empty">Nenhum dado de não conformidades para exibir.</div>';
    return;
  }
  const isCadastro = s.path === 'Cadastro';
  view.innerHTML = head +
    `<div class="toolbar"><input type="search" placeholder="Buscar em ${s.title}..." aria-label="Buscar">` +
    `<button class="btn accent">${isCadastro ? 'Novo' : 'Novo apontamento'}</button></div>` +
    `<div class="card"><table><thead><tr>${s.cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>` +
    `<tbody><tr><td class="empty" colspan="${s.cols.length}">Nenhum registro encontrado.</td></tr></tbody></table></div>`;
}
window.addEventListener('hashchange', render);
render();
