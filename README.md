# Ludo Friends — Vercel estável (sem WebSocket)

Esta versão não usa P2P, Socket.IO ou WebSocket. O jogo sincroniza por API HTTP + Upstash Redis, o que evita o loop de “reconectando” entre Wi‑Fi/4G diferentes.

## Publicar na Vercel
1. Substitua os arquivos do projeto pelos deste ZIP.
2. Na Vercel: projeto > Storage/Marketplace > **Upstash for Redis** > conecte/crie um banco Redis.
3. Confirme que a integração criou as variáveis `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (também aceita as antigas `KV_REST_API_URL` e `KV_REST_API_TOKEN`).
4. Faça um **Redeploy** depois de conectar o Redis.
5. Abra `/api/health` no seu domínio. Deve aparecer `{"ok":true,...}`.
6. Abra o site normalmente. O dono cria a sala automaticamente; o convidado entra pelo link sem Nick e sem digitar código.

Se o Redis não estiver conectado, a própria tela do jogo mostrará “Falta conectar o banco Redis” em vez de ficar carregando sem fim.
