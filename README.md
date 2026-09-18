# Ludo Friends — versão simples para Vercel

Esta versão não usa Redis, banco de dados, Socket.IO nem variáveis de ambiente.

## Publicar

1. Substitua os arquivos do projeto pelos desta pasta.
2. Envie para o GitHub conectado à Vercel.
3. Aguarde o deploy.

Pronto. Não existe configuração adicional na Vercel.

## Multiplayer

- A página aberta sem `?room=` cria uma sala.
- O botão de convite gera o link da sala.
- Quem abre o convite entra automaticamente, sem Nick e sem código.
- A conexão usa PeerJS Cloud para sinalização.
- Se a conexão direta entre os aparelhos for bloqueada, há fallback TURN para redes diferentes, incluindo Wi-Fi x 4G/5G.

> Observação: esta é a opção de menor configuração. Ela depende de serviços públicos de sinalização/relay de terceiros, então para grande volume de jogadores o ideal futuramente é usar infraestrutura própria.
