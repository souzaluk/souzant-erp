# Souzant ERP
App desktop Windows (Electron) com auto-atualização, bandeja do sistema e início com o Windows.

- `npm install && npm start` — desenvolvimento
- `npm run dist` — gera o instalador local em `dist/`
- **Publicar versão:** aumente `version` no `package.json`, `git tag vX.Y.Z && git push --tags`. O GitHub Actions gera o `.exe` e publica a Release; os apps instalados se atualizam ao abrir.
