# Ludo Friends — Vercel WebSocket

Versão sem PeerJS, sem TURN, sem Redis e sem variáveis de ambiente.

## Publicar

1. Apague os arquivos antigos do projeto do Ludo no GitHub.
2. Envie TODO o conteúdo desta pasta para a raiz do repositório.
3. Na Vercel, deixe o Framework Preset como **Nuxt.js** (normalmente é detectado automaticamente).
4. Faça Redeploy.

Não adicione Storage, Redis, Upstash nem variáveis.

## Teste

- Abra a URL normal: cria a sala como Jogador 1.
- Compartilhe o link exibido.
- Abra o convite em outro celular, inclusive no 4G/5G.
- O convidado entra como Jogador 2 automaticamente.

A conexão usa o WebSocket nativo da Vercel. Se a função reiniciar ou o navegador ficar em segundo plano, o cliente reconecta automaticamente e o Jogador 1 envia novamente o estado atual da partida.
