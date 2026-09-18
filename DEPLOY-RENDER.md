# Deploy do NEXUS MAX v0.5 no Render

1. No GitHub, deixe os arquivos do projeto **diretamente na raiz do repositório**.
2. No Render, crie/abra o Web Service conectado ao repositório.
3. Language: **Node**.
4. Build Command: `npm install`.
5. Start Command: `npm start`.
6. Escolha o plano desejado (Free serve para teste).
7. As chaves de API devem ser adicionadas em **Environment Variables** no Render, nunca no GitHub.
8. Faça o deploy e abra a URL `https://...onrender.com`.

O NEXUS agora serve `index.html` e `manifest.webmanifest` diretamente da raiz, portanto não precisa da pasta `public`.

### Variáveis opcionais

- `OPENAI_API_KEY` / `OPENAI_MODEL`
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`
- `GEMINI_API_KEY` / `GEMINI_MODEL`
- `XAI_API_KEY` / `XAI_MODEL`

Sem chaves, o app funciona em modo DEMO.
