# NEXUS AI v0.4 MAX ONLINE

Baseada no teste visual do celular, esta versão aumenta a interface mobile e adiciona:
- modo ONLINE/DEMO;
- voz para entrada (Web Speech API);
- leitura da resposta por voz;
- anexos TXT/CSV/JSON/MD enviados ao Nexus;
- memória de projeto;
- ferramentas visíveis no plano;
- layout mobile-first.

## Teste no celular
O NEXUS precisa ser servido por HTTP/HTTPS para que o PWA e as chamadas `/api` funcionem.

1. Copie `.env.example` para `.env` e configure pelo menos uma API.
2. `node server.mjs`
3. No celular, abra `http://IP-DO-PC:3000` na mesma Wi-Fi.
4. Chrome → menu → Adicionar à tela inicial/Instalar app.

## Voz
O botão 🎙️ usa reconhecimento de voz do navegador. O botão "Ler última resposta" usa síntese de voz do navegador.

## Segurança
Nunca coloque chaves de API no HTML ou no APK. Elas devem ficar no backend/servidor.
