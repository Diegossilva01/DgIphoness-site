# Ludo Friends — versão Vercel

Esta versão foi adaptada para WebSockets da Vercel e usa Redis para manter salas e sincronização mesmo quando os jogadores caem em instâncias diferentes.

## Publicar
1. Envie todos os arquivos desta pasta para o repositório conectado à Vercel.
2. Na Vercel, abra o projeto > Storage/Marketplace > Redis e conecte um banco Redis ao projeto. A integração adiciona `REDIS_URL` automaticamente.
3. Confirme que Fluid Compute está habilitado no projeto (necessário para WebSockets).
4. Faça um novo Deploy.
5. Abra o site em um celular, copie o convite e abra em outro celular usando outra rede/4G.

Não precisa configurar domínio separado para o servidor: o Socket.IO usa `/api/socket-io/socket.io` no mesmo domínio do site.
