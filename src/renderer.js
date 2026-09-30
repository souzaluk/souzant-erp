// Define a foto do usuário no avatar (URL ou data URI); sem foto mostra o ícone padrão.
function setAvatar(url) {
  const img = document.getElementById('avatar-img');
  const fallback = document.getElementById('avatar-fallback');
  if (url) { img.src = url; img.hidden = false; fallback.style.display = 'none'; }
  else { img.hidden = true; fallback.style.display = ''; }
}
window.setAvatar = setAvatar;
setAvatar(null);
