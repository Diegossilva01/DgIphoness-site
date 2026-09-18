(function(){
  const COLORS=['red','green','yellow','blue'];
  const PATH=[
    [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
    [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
    [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]
  ];
  const START_OFFSET={red:51,green:12,yellow:25,blue:38};
  const SAFE_GLOBAL=new Set([51,12,25,38,4,17,30,43]);
  const LANES={
    red:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    green:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
    yellow:[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
    blue:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
  };
  const YARDS={
    red:[[2,2],[2,4],[4,2],[4,4]],
    green:[[2,10],[2,12],[4,10],[4,12]],
    yellow:[[10,10],[10,12],[12,10],[12,12]],
    blue:[[10,2],[10,4],[12,2],[12,4]]
  };

  function newGame(players){
    return {
      phase:'playing',
      players:players.map((p,i)=>({...p,color:COLORS[i],finished:false})),
      pieces:players.flatMap((p,i)=>Array.from({length:4},(_,piece)=>({
        id:`${p.id}-${piece}`,playerId:p.id,color:COLORS[i],piece,progress:-1
      }))),
      turn:0,dice:null,rolled:false,winner:null,log:['A partida começou!']
    };
  }
  function globalIndex(piece){
    if(piece.progress<0||piece.progress>51) return null;
    return (START_OFFSET[piece.color]+piece.progress)%PATH.length;
  }
  function coordForPiece(piece){
    if(piece.progress===-1) return YARDS[piece.color][piece.piece];
    if(piece.progress>=0&&piece.progress<=51) return PATH[globalIndex(piece)];
    if(piece.progress>=52&&piece.progress<=57) return LANES[piece.color][piece.progress-52];
    if(piece.progress===58) return [7,7];
    return YARDS[piece.color][piece.piece];
  }
  function isFinished(piece){return piece.progress===58;}
  function piecesForPlayer(game,playerId){return game.pieces.filter(p=>p.playerId===playerId);}
  function playerById(game,id){return game.players.find(p=>p.id===id);}
  function currentPlayer(game){return game.players[game.turn];}
  function canMovePiece(piece,dice){
    if(isFinished(piece)) return false;
    if(piece.progress===-1) return dice===6;
    return piece.progress+dice<=58;
  }
  function movablePieces(game){
    if(!game.rolled||!game.dice||game.winner) return [];
    const current=currentPlayer(game);
    if(!current) return [];
    return piecesForPlayer(game,current.id).filter(p=>canMovePiece(p,game.dice));
  }
  function nextTurn(game){
    game.turn=(game.turn+1)%game.players.length;
    game.dice=null;game.rolled=false;
  }
  function roll(game,playerId,forcedValue){
    if(game.winner) return {ok:false,error:'A partida terminou.'};
    if(currentPlayer(game)?.id!==playerId) return {ok:false,error:'Não é sua vez.'};
    if(game.rolled) return {ok:false,error:'O dado já foi jogado.'};
    const dice=forcedValue||Math.floor(Math.random()*6)+1;
    game.dice=dice;game.rolled=true;
    const name=currentPlayer(game).name;
    game.log.unshift(`${name} tirou ${dice}.`);
    if(movablePieces(game).length===0){
      game.log.unshift(`${name} não tem jogada disponível.`);
      if(dice===6){game.dice=null;game.rolled=false;}
      else nextTurn(game);
    }
    return {ok:true,dice};
  }
  function captureAt(game,movedPiece){
    if(movedPiece.progress<0||movedPiece.progress>51) return 0;
    const gi=globalIndex(movedPiece);
    if(SAFE_GLOBAL.has(gi)) return 0;
    let captured=0;
    for(const p of game.pieces){
      if(p.id===movedPiece.id||p.color===movedPiece.color) continue;
      if(p.progress>=0&&p.progress<=51&&globalIndex(p)===gi){p.progress=-1;captured++;}
    }
    return captured;
  }
  function move(game,playerId,pieceId){
    if(!game.rolled||!game.dice) return {ok:false,error:'Jogue o dado primeiro.'};
    if(currentPlayer(game)?.id!==playerId) return {ok:false,error:'Não é sua vez.'};
    const piece=game.pieces.find(p=>p.id===pieceId&&p.playerId===playerId);
    if(!piece||!canMovePiece(piece,game.dice)) return {ok:false,error:'Movimento inválido.'};
    const rolled=game.dice;
    if(piece.progress===-1) piece.progress=0; else piece.progress+=rolled;
    const player=playerById(game,playerId);
    const captured=captureAt(game,piece);
    if(captured) game.log.unshift(`${player.name} capturou ${captured} peça${captured>1?'s':''}!`);
    if(piece.progress===58) game.log.unshift(`${player.name} colocou uma peça na chegada!`);
    const allHome=piecesForPlayer(game,playerId).every(isFinished);
    if(allHome){
      player.finished=true;game.winner=playerId;game.phase='finished';
      game.log.unshift(`🏆 ${player.name} venceu a partida!`);
      game.dice=null;game.rolled=false;
      return {ok:true,captured,won:true};
    }
    if(rolled===6){
      game.dice=null;game.rolled=false;
      game.log.unshift(`${player.name} joga novamente por ter tirado 6.`);
    }else nextTurn(game);
    return {ok:true,captured,won:false};
  }
  window.LudoEngine={COLORS,PATH,START_OFFSET,SAFE_GLOBAL,LANES,YARDS,newGame,globalIndex,coordForPiece,currentPlayer,movablePieces,roll,move,piecesForPlayer};
})();

(() => {
  const $=s=>document.querySelector(s);
  const DICE_CHARS=['⚀','⚁','⚂','⚃','⚄','⚅'];
  const els={
    mode:$('#modeView'),lobby:$('#lobbyView'),game:$('#gameView'),friendMode:$('#friendModeBtn'),botMode:$('#botModeBtn'),localMode:$('#localModeBtn'),
    brand:$('#brandBtn'),back:$('#backBtn'),newGame:$('#newGameBtn'),cancelLobby:$('#cancelLobbyBtn'),share:$('#shareBtn'),copy:$('#copyBtn'),
    lobbyTitle:$('#lobbyTitle'),lobbyText:$('#lobbyText'),lobbyStatus:$('#lobbyStatus'),roomCode:$('#roomCode'),inviteLink:$('#inviteLink'),
    gameModeLabel:$('#gameModeLabel'),turnTitle:$('#turnTitle'),board:$('#board'),dice:$('#dice'),roll:$('#rollBtn'),hint:$('#actionHint'),
    score:$('#scoreList'),log:$('#gameLog'),roundBadge:$('#roundBadge'),sound:$('#soundBtn'),toast:$('#toast'),badge:$('#connectionBadge')
  };

  let state=null, mode='bot', soundOn=true, botTimer=null, busy=false;
  let peer=null, conn=null, roomCode='', inviteUrl='', reconnectTimer=null, onlineStarted=false;
  const HUMAN_ID='player1', BOT_ID='bot', HUMAN2_ID='player2', HOST_ID='player1', GUEST_ID='player2';
  const ICE_CONFIG={iceServers:[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}
  ]};

  function showView(name){[els.mode,els.lobby,els.game].forEach(v=>v?.classList.remove('active'));els[name]?.classList.add('active');}
  function toast(msg){els.toast.textContent=msg;els.toast.classList.remove('hidden');setTimeout(()=>els.toast.classList.add('hidden'),1800);}
  function beep(freq=520,duration=.08){if(!soundOn)return;try{const ac=new (window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=freq;o.connect(g);g.connect(ac.destination);g.gain.setValueAtTime(.05,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);o.start();o.stop(ac.currentTime+duration);}catch{}}
  function cssColor(c){return ({red:'#ff4d5e',green:'#21c16b',yellow:'#f5c941',blue:'#4285ff'})[c]||'#999';}
  function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]));}
  function playerName(id){return state?.players?.find(p=>p.id===id)?.name||'Jogador';}
  function currentId(){return state?LudoEngine.currentPlayer(state)?.id:null;}
  function isBotTurn(){return mode==='bot'&&currentId()===BOT_ID&&!state?.winner;}
  function clearBotTimer(){if(botTimer){clearTimeout(botTimer);botTimer=null;}}
  function isOnline(){return mode==='friend-host'||mode==='friend-guest';}
  function myOnlineId(){return mode==='friend-host'?HOST_ID:GUEST_ID;}
  function canAct(){if(!state||state.winner||busy)return false;if(mode==='local')return true;if(mode==='bot')return currentId()===HUMAN_ID;if(isOnline())return currentId()===myOnlineId()&&!!conn?.open;return false;}

  function startBotGame(){cleanupOnline(false);clearBotTimer();mode='bot';busy=false;state=LudoEngine.newGame([{id:HUMAN_ID,name:'Você'},{id:BOT_ID,name:'Robô 🤖'}]);els.gameModeLabel.textContent='Contra o Robô';els.badge.textContent='offline • robô';els.newGame.style.display='';showView('game');buildBoard();render();}
  function startLocalGame(){cleanupOnline(false);clearBotTimer();mode='local';busy=false;state=LudoEngine.newGame([{id:HUMAN_ID,name:'Jogador 1'},{id:HUMAN2_ID,name:'Jogador 2'}]);els.gameModeLabel.textContent='2 jogadores • mesmo celular';els.badge.textContent='offline • local';els.newGame.style.display='';showView('game');buildBoard();render();}

  function randomRoom(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let r='';for(let i=0;i<6;i++)r+=chars[Math.floor(Math.random()*chars.length)];return r;}
  function hostPeerId(code){return 'ludo-friends-'+code.toLowerCase();}
  function setLobbyStatus(text,type=''){els.lobbyStatus.className='connection-state'+(type?' '+type:'');els.lobbyStatus.querySelector('span').textContent=text;}
  function createPeer(id){
    if(typeof Peer==='undefined'){setLobbyStatus('Não foi possível carregar a conexão online.','error');toast('Falha ao carregar conexão online.');return null;}
    return new Peer(id||undefined,{debug:0,config:ICE_CONFIG});
  }
  function bindPeerCommon(p,role){
    p.on('disconnected',()=>{els.badge.textContent='reconectando...';setLobbyStatus('Reconectando...');try{p.reconnect();}catch{}scheduleReconnect(role);});
    p.on('close',()=>{els.badge.textContent='desconectado';scheduleReconnect(role);});
    p.on('error',err=>{
      console.warn('Peer error',err);
      if(err?.type==='peer-unavailable'&&role==='guest'){setLobbyStatus('Sala ainda não disponível. Tentando novamente...');scheduleReconnect(role,1200);return;}
      if(err?.type==='unavailable-id'&&role==='host'){setLobbyStatus('Recuperando a sala...');scheduleReconnect(role,1500);return;}
      setLobbyStatus('Reconectando...');scheduleReconnect(role,1800);
    });
  }
  function scheduleReconnect(role,delay=1000){clearTimeout(reconnectTimer);reconnectTimer=setTimeout(()=>{if(role==='host'&&mode==='friend-host')setupHost(roomCode,true);if(role==='guest'&&mode==='friend-guest')setupGuest(roomCode,true);},delay);}
  function closePeerOnly(){clearTimeout(reconnectTimer);reconnectTimer=null;try{conn?.close();}catch{}conn=null;try{peer?.destroy();}catch{}peer=null;}
  function cleanupOnline(clearUrl=true){closePeerOnly();onlineStarted=false;if(clearUrl&&isOnline()){history.replaceState({},'',location.pathname);}}

  function startFriendHost(code){clearBotTimer();cleanupOnline(false);mode='friend-host';roomCode=code||randomRoom();inviteUrl=`${location.origin}${location.pathname}?room=${encodeURIComponent(roomCode)}`;history.replaceState({},'',`${location.pathname}?host=${encodeURIComponent(roomCode)}`);els.roomCode.textContent=roomCode;els.inviteLink.textContent=inviteUrl;els.lobbyTitle.textContent='Sala criada';els.lobbyText.textContent='Envie o link para seu amigo. Quando ele entrar, a partida começa automaticamente.';els.share.style.display='';els.copy.style.display='';els.badge.textContent='criando sala...';setLobbyStatus('Preparando sala...');showView('lobby');setupHost(roomCode,false);}
  function setupHost(code,isRetry){closePeerOnly();mode='friend-host';peer=createPeer(hostPeerId(code));if(!peer)return;bindPeerCommon(peer,'host');peer.on('open',()=>{els.badge.textContent='online • aguardando amigo';setLobbyStatus('Sala pronta. Aguardando seu amigo...','connected');});peer.on('connection',c=>{if(conn?.open){try{c.close();}catch{}return;}conn=c;bindConnection(c,'host');});}

  function startFriendGuest(code){clearBotTimer();cleanupOnline(false);mode='friend-guest';roomCode=code;history.replaceState({},'',`${location.pathname}?room=${encodeURIComponent(code)}`);els.roomCode.textContent=code;els.inviteLink.textContent='Entrando na sala...';els.lobbyTitle.textContent='Entrando na partida';els.lobbyText.textContent='Conectando com seu amigo. Você entra direto quando a sala responder.';els.share.style.display='none';els.copy.style.display='none';els.badge.textContent='conectando...';setLobbyStatus('Procurando a sala...');showView('lobby');setupGuest(code,false);}
  function setupGuest(code,isRetry){closePeerOnly();mode='friend-guest';peer=createPeer();if(!peer)return;bindPeerCommon(peer,'guest');peer.on('open',()=>{els.badge.textContent='conectando...';connectToHost(code);});}
  function connectToHost(code){if(!peer||peer.destroyed)return;try{conn=peer.connect(hostPeerId(code),{reliable:true,serialization:'json'});bindConnection(conn,'guest');}catch{scheduleReconnect('guest',1200);}}

  function bindConnection(c,role){
    let opened=false;
    c.on('open',()=>{opened=true;els.badge.textContent='online • conectado';setLobbyStatus('Amigo conectado! Iniciando partida...','connected');if(role==='host'){if(!state||!onlineStarted){state=LudoEngine.newGame([{id:HOST_ID,name:'Jogador 1'},{id:GUEST_ID,name:'Jogador 2'}]);onlineStarted=true;}sendState();enterOnlineGame();}else{c.send({type:'hello'});}});
    c.on('data',msg=>handleOnlineMessage(msg,role));
    c.on('close',()=>{els.badge.textContent='reconectando...';if(isOnline()){toast('Conexão caiu. Reconectando...');scheduleReconnect(role,800);}});
    c.on('error',()=>{if(!opened)scheduleReconnect(role,1000);});
  }
  function handleOnlineMessage(msg,role){if(!msg||typeof msg!=='object')return;
    if(role==='host'){
      if(msg.type==='hello'){sendState();if(state)enterOnlineGame();return;}
      if(msg.type==='action'&&state){if(msg.action==='roll'&&currentId()===GUEST_ID){const r=LudoEngine.roll(state,GUEST_ID);if(r.ok)broadcastAfterHostChange(r.dice);}else if(msg.action==='move'&&currentId()===GUEST_ID){const r=LudoEngine.move(state,GUEST_ID,msg.pieceId);if(r.ok)broadcastAfterHostChange();}}
      if(msg.type==='restart'){startOnlineMatchHost();}
    }else{
      if(msg.type==='state'&&msg.state){state=msg.state;onlineStarted=true;enterOnlineGame();render();}
    }
  }
  function sendState(){if(conn?.open&&state)conn.send({type:'state',state});}
  function broadcastAfterHostChange(dice){if(dice)animateDice(dice);sendState();render();}
  function enterOnlineGame(){if(!state)return;els.gameModeLabel.textContent='Online • com amigo';els.badge.textContent=conn?.open?'online • conectado':'reconectando...';els.newGame.style.display=mode==='friend-host'?'':'none';showView('game');buildBoard();render();}
  function startOnlineMatchHost(){if(mode!=='friend-host')return;state=LudoEngine.newGame([{id:HOST_ID,name:'Jogador 1'},{id:GUEST_ID,name:'Jogador 2'}]);onlineStarted=true;sendState();enterOnlineGame();}

  function goMenu(){clearBotTimer();cleanupOnline(true);state=null;busy=false;mode='menu';els.badge.textContent='pronto';showView('mode');}

  function buildBoard(){els.board.innerHTML='';for(let r=0;r<15;r++)for(let c=0;c<15;c++){const cell=document.createElement('div');cell.className='cell';const onPath=LudoEngine.PATH.some(([rr,cc])=>rr===r&&cc===c);if(onPath)cell.classList.add('track');if(r<=5&&c<=5)cell.classList.add('home-red');if(r<=5&&c>=9)cell.classList.add('home-green');if(r>=9&&c>=9)cell.classList.add('home-yellow');if(r>=9&&c<=5)cell.classList.add('home-blue');for(const color of LudoEngine.COLORS){if(LudoEngine.LANES[color].some(([rr,cc])=>rr===r&&cc===c))cell.classList.add('lane-'+color);}for(const [color,offset] of Object.entries(LudoEngine.START_OFFSET)){const [rr,cc]=LudoEngine.PATH[offset];if(rr===r&&cc===c)cell.classList.add('start-'+color,'safe');}const gi=LudoEngine.PATH.findIndex(([rr,cc])=>rr===r&&cc===c);if(LudoEngine.SAFE_GLOBAL.has(gi))cell.classList.add('safe');els.board.appendChild(cell);}const center=document.createElement('div');center.className='center-home';els.board.appendChild(center);}

  function render(){if(!state)return;const current=LudoEngine.currentPlayer(state),botTurn=isBotTurn();if(state.winner){els.turnTitle.textContent=`${playerName(state.winner)} venceu! 🏆`;els.roundBadge.textContent='Finalizada';els.hint.textContent=`${playerName(state.winner)} levou as 4 peças para a chegada.`;}else{els.roundBadge.textContent='Em jogo';if(mode==='bot')els.turnTitle.textContent=botTurn?'Vez do Robô 🤖':'Sua vez!';else if(isOnline())els.turnTitle.textContent=current?.id===myOnlineId()?'Sua vez!':`Vez de ${current?.name||''}`;else els.turnTitle.textContent=`Vez de ${current?.name||''}`;if(isOnline()&&!conn?.open)els.hint.textContent='Reconectando com seu amigo...';else if(botTurn)els.hint.textContent='O robô está pensando...';else if(!state.rolled)els.hint.textContent=canAct()?'Jogue o dado.':'Aguarde sua vez.';else els.hint.textContent=canAct()?'Escolha uma peça destacada.':'Aguarde a jogada do outro jogador.';}
    els.dice.textContent=state.dice?DICE_CHARS[state.dice-1]:'⚄';els.roll.disabled=!!state.winner||busy||botTurn||state.rolled||!canAct();els.score.innerHTML=state.players.map(p=>{const home=LudoEngine.piecesForPlayer(state,p.id).filter(x=>x.progress===58).length;return `<div class="score-row ${current?.id===p.id&&!state.winner?'active':''}"><div class="score-info"><span class="player-dot" style="background:${cssColor(p.color)}"></span><strong>${escapeHtml(p.name)}</strong></div><span class="score-home">${home}/4 🏠</span></div>`;}).join('');els.log.innerHTML=(state.log||[]).slice(0,14).map(x=>`<div class="log-line">${escapeHtml(x)}</div>`).join('');renderPieces();if(botTurn&&!busy)scheduleBotTurn();}

  function renderPieces(){els.board.querySelectorAll('.piece').forEach(x=>x.remove());if(!state?.pieces)return;const current=LudoEngine.currentPlayer(state);const movable=new Set((LudoEngine.movablePieces(state)||[]).map(p=>p.id));const groups={};state.pieces.forEach(p=>{const [r,c]=LudoEngine.coordForPiece(p);const k=`${r},${c}`;(groups[k]||=[]).push(p);});Object.values(groups).forEach(group=>group.forEach((p,idx)=>{const [r,c]=LudoEngine.coordForPiece(p);const el=document.createElement('button');el.className=`piece ${p.color}`;el.type='button';const spread=group.length>1?1.1:0,angle=(Math.PI*2*idx)/group.length;el.style.left=(((c+.5)/15)*100+Math.cos(angle)*spread)+'%';el.style.top=(((r+.5)/15)*100+Math.sin(angle)*spread)+'%';el.title=`Peça ${p.piece+1}`;const allowed=!busy&&!state.winner&&current?.id===p.playerId&&movable.has(p.id)&&((mode==='local')||(mode==='bot'&&p.playerId===HUMAN_ID)||(isOnline()&&p.playerId===myOnlineId()&&conn?.open));if(allowed){el.classList.add('movable');el.addEventListener('click',()=>humanMove(p.id));}els.board.appendChild(el);}));}

  function animateDice(value){els.dice.classList.remove('rolling');void els.dice.offsetWidth;els.dice.classList.add('rolling');setTimeout(()=>{if(value)els.dice.textContent=DICE_CHARS[value-1];},180);}
  function humanRoll(){if(!state||busy||state.winner||!canAct())return;if(mode==='friend-guest'){conn?.send({type:'action',action:'roll'});return;}const current=LudoEngine.currentPlayer(state),result=LudoEngine.roll(state,current.id);if(!result.ok){toast(result.error);return;}animateDice(result.dice);beep(560);if(mode==='friend-host')sendState();render();if(!state.rolled)setTimeout(()=>{if(mode==='friend-host')sendState();render();},300);}
  function humanMove(pieceId){if(!state||busy||state.winner||!canAct())return;if(mode==='friend-guest'){conn?.send({type:'action',action:'move',pieceId});return;}const current=LudoEngine.currentPlayer(state),result=LudoEngine.move(state,current.id,pieceId);if(!result.ok){toast(result.error);return;}beep(result.won?880:result.captured?720:500,.1);if(mode==='friend-host')sendState();render();}

  function projectedProgress(piece,dice){if(piece.progress===-1)return dice===6?0:-1;return piece.progress+dice;}
  function projectedGlobal(piece,dice){const pp=projectedProgress(piece,dice);if(pp<0||pp>51)return null;return (LudoEngine.START_OFFSET[piece.color]+pp)%LudoEngine.PATH.length;}
  function botScore(piece,dice){const pp=projectedProgress(piece,dice);let score=0;if(pp===58)score+=6000;if(piece.progress===-1&&dice===6)score+=900;if(pp>=52)score+=700+(pp-52)*90;score+=Math.max(0,pp)*6;const gi=projectedGlobal(piece,dice);if(gi!==null){const enemies=state.pieces.filter(p=>p.playerId!==BOT_ID&&p.progress>=0&&p.progress<=51&&LudoEngine.globalIndex(p)===gi);if(enemies.length&&!LudoEngine.SAFE_GLOBAL.has(gi))score+=2500*enemies.length;if(LudoEngine.SAFE_GLOBAL.has(gi))score+=180;}if(piece.progress>=0)score+=120;return score+Math.random()*25;}
  function chooseBotPiece(){const movable=LudoEngine.movablePieces(state);if(!movable.length)return null;return [...movable].sort((a,b)=>botScore(b,state.dice)-botScore(a,state.dice))[0];}
  function scheduleBotTurn(){clearBotTimer();if(!isBotTurn()||state.winner)return;busy=true;renderPieces();els.roll.disabled=true;botTimer=setTimeout(()=>{botTimer=null;if(!isBotTurn()||state.winner){busy=false;render();return;}const result=LudoEngine.roll(state,BOT_ID);if(result.ok){animateDice(result.dice);beep(430);}render();if(!state.rolled){busy=false;botTimer=setTimeout(()=>{botTimer=null;render();},650);return;}botTimer=setTimeout(()=>{botTimer=null;const piece=chooseBotPiece();if(piece){const moved=LudoEngine.move(state,BOT_ID,piece.id);if(moved.ok)beep(moved.won?880:moved.captured?700:460,.1);}busy=false;render();},750);},700);}

  async function shareInvite(){if(!inviteUrl)return;try{if(navigator.share){await navigator.share({title:'Ludo Friends',text:'Joga Ludo comigo!',url:inviteUrl});}else{await navigator.clipboard.writeText(inviteUrl);toast('Link copiado!');}}catch{}}
  async function copyInvite(){if(!inviteUrl)return;try{await navigator.clipboard.writeText(inviteUrl);toast('Link copiado!');}catch{toast('Segure o link para copiar.');}}

  els.friendMode.addEventListener('click',()=>startFriendHost(randomRoom()));
  els.botMode.addEventListener('click',startBotGame);els.localMode.addEventListener('click',startLocalGame);els.roll.addEventListener('click',humanRoll);els.back.addEventListener('click',goMenu);els.cancelLobby.addEventListener('click',goMenu);els.brand.addEventListener('click',e=>{e.preventDefault();goMenu();});
  els.newGame.addEventListener('click',()=>{if(mode==='bot')startBotGame();else if(mode==='local')startLocalGame();else if(mode==='friend-host')startOnlineMatchHost();});
  els.sound.addEventListener('click',()=>{soundOn=!soundOn;els.sound.textContent=soundOn?'🔊':'🔇';});els.share.addEventListener('click',shareInvite);els.copy.addEventListener('click',copyInvite);

  const params=new URLSearchParams(location.search);const join=params.get('room'),host=params.get('host');
  if(join)startFriendGuest(join.toUpperCase());else if(host)startFriendHost(host.toUpperCase());
})();
