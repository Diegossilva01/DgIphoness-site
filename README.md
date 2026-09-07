# ⚓ Batalha Naval Online

Jogo de Batalha Naval para **2 jogadores em tempo real**, com salas por link e conversa por voz usando WebRTC.

## Recursos

- 2 jogadores na mesma sala
- Link de convite com código da sala
- Posicionamento manual ou automático dos navios
- Validação da frota no servidor
- Turnos, tiros, acertos, navios afundados e vitória validados no servidor
- O adversário não recebe a posição dos seus navios
- Conversa por voz via WebRTC
- Efeitos sonoros gerados no próprio navegador
- Revanche
- Layout responsivo para celular e computador
- Endpoint `/health` para hospedagens

## Rodar no computador

Requer **Node.js 18 ou superior**.

```bash
npm install
npm start
```

Depois abra:

```text
http://localhost:3000
```

Para testar multiplayer, abra em dois navegadores/abas: crie uma sala em um deles, copie o link e abra no outro.

## Publicar no GitHub

Envie todos os arquivos deste projeto para um repositório GitHub. O `node_modules` não deve ser enviado.

> **Importante:** GitHub Pages sozinho não executa o servidor Node.js. O projeto precisa ser hospedado em um serviço que rode Node.js, como Render, Railway, VPS, Fly.io ou similar.

## Render

Este projeto inclui `render.yaml`. No Render, conecte o repositório e crie o serviço a partir dele.

- Build command: `npm install`
- Start command: `npm start`
- Health check: `/health`

Depois você pode apontar seu domínio para a URL fornecida pela hospedagem.

## Conversa por voz

Em produção, o navegador exige **HTTPS** para liberar o microfone. Em `localhost`, o microfone funciona sem HTTPS.

Por padrão, o projeto usa um servidor STUN público. Para melhorar a conexão de voz em redes mais restritas, configure um servidor TURN com estas variáveis de ambiente:

```text
TURN_URL=turn:seu-servidor-turn:3478
TURN_USERNAME=usuario
TURN_CREDENTIAL=senha
```

Sem TURN, a voz funciona na maioria das redes comuns, mas pode falhar em alguns tipos de NAT/firewall.

## Estrutura

```text
batalha-naval-online/
├── gameLogic.js
├── server.js
├── package.json
├── render.yaml
├── README.md
├── test/
│   └── gameLogic.test.js
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## Segurança do jogo

A posição da frota fica no servidor. O cliente adversário só recebe o resultado do tiro (`acerto` ou `água`), evitando que a posição dos navios seja exposta pelo estado normal do jogo.
