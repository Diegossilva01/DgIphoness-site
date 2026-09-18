# Ludo Friends

Site de Ludo online para 2 a 4 jogadores, com convite por código e link.

## Como publicar

É um site estático. Você pode publicar no GitHub Pages, Netlify, Cloudflare Pages ou qualquer hospedagem de HTML.

Arquivos principais:
- `index.html`
- `styles.css`
- `game.js`
- `app.js`

## Multiplayer

O projeto usa PeerJS/WebRTC para conectar os jogadores diretamente. O dono da sala funciona como host da partida, então ele precisa manter a página aberta.

## Como jogar

1. Clique em **Criar sala**.
2. Digite seu nome.
3. Compartilhe o link ou código.
4. Quando houver pelo menos 2 jogadores, o dono da sala clica em **Iniciar partida**.
5. Tire 6 para colocar uma peça no tabuleiro.
6. Leve suas 4 peças até a chegada no centro.
7. Se cair em uma casa ocupada por adversário e ela não for segura, a peça dele volta para a base.
8. Tirar 6 dá outra jogada.

Observação: o modo online depende de internet e do serviço público de sinalização do PeerJS.
