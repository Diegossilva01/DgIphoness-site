# Ludo Friends — entrada automática

Versão sem Nick e sem formulário de entrada.

## Como funciona

- Ao abrir `index.html` sem parâmetros, o site cria uma sala automaticamente e entra como **Jogador 1**.
- O dono compartilha o link gerado na própria sala.
- Quem abrir o convite `?room=CODIGO` entra automaticamente como **Jogador 2**, **Jogador 3** ou **Jogador 4**.
- Ninguém precisa digitar nome nem código da sala.
- O dono inicia a partida quando houver pelo menos 2 jogadores.
- Se houver uma oscilação, a versão continua tentando reconectar automaticamente.

## Publicação

Suba `index.html`, `styles.css`, `app.js` e `game.js` juntos no mesmo diretório do seu site.

A conexão usa PeerJS/WebRTC. Para máxima compatibilidade entre qualquer operadora/rede, uma etapa futura pode adicionar um servidor TURN próprio.
