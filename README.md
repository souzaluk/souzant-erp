# Souzant ERP
App desktop Windows (Electron) com auto-atualização, bandeja do sistema e início com o Windows.

- `npm install && npm start` — desenvolvimento
- `npm run dist` — gera o instalador local em `dist/`
## Publicar uma nova versão

1. Aumente `version` no `package.json` (ex.: `1.6.5` → `1.6.6`).
2. Faça commit e push na `main`:
   ```bash
   git commit -am "vX.Y.Z" && git push origin main
   ```
3. Crie e envie a tag, com o mesmo número da versão:
   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```
4. O GitHub Actions (`.github/workflows/release.yml`) gera o `.exe` e publica a Release em alguns minutos. Acompanhe com `gh run watch`.

Os apps instalados se atualizam ao abrir. Para receber a nova versão, feche o app pela bandeja (botão direito > Sair) e abra de novo.

> Não use `npm run release` localmente: no Windows ele falha ao extrair o `winCodeSign` (links simbólicos exigem Modo de Desenvolvedor ou administrador). O build oficial roda no GitHub Actions.
