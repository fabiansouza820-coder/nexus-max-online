# NEXUS AI MAX v0.5 — ONLINE (estrutura raiz)

Versão preparada para deploy simples no Render pelo GitHub, sem depender da pasta `public`.

## Estrutura

Todos os arquivos principais ficam na raiz:
- `index.html`
- `manifest.webmanifest`
- `server.mjs`
- `package.json`
- `render.yaml`
- `projects.json`

## Rodar

```bash
npm install
npm start
```

Abra `http://localhost:3000`.

## APIs

Configure as chaves no ambiente do servidor (Render), nunca no navegador/GitHub:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `XAI_API_KEY`

Sem chaves, o app abre em modo DEMO.

## Observação sobre memória

`projects.json` é uma memória local simples para teste. Em hospedagem com armazenamento efêmero, ela pode ser perdida após reinício/deploy. Para produção, migrar a memória para banco de dados.
