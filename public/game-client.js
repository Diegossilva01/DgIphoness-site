(function(){
  const COLORS = ['red','green','yellow','blue'];
  const COLOR_LABELS = {red:'Vermelho',green:'Verde',yellow:'Amarelo',blue:'Azul'};

  const PATH = [
    [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
    [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
    [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]
  ];
  const START_OFFSET = {red:51, green:12, yellow:25, blue:38};
  const SAFE_GLOBAL = new Set([51,12,25,38,4,17,30,43]);
  const LANES = {
    red:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    green:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
    yellow:[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
    blue:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
  };
  const YARDS = {
    red:[[2,2],[2,4],[4,2],[4,4]],
    green:[[2,10],[2,12],[4,10],[4,12]],
    yellow:[[10,10],[10,12],[12,10],[12,12]],
    blue:[[10,2],[10,4],[12,2],[12,4]]
  };

  function colorOfPlayer(index){ return COLORS[index % COLORS.length]; }
  function newGame(players){
    return {
      phase:'playing', roomCode:'',
      players:players.map((p,i)=>({...p,color:colorOfPlayer(i),finished:false})),
      pieces:players.flatMap((p,i)=>Array.from({length:4},(_,piece)=>({
        id:`${p.id}-${piece}`, playerId:p.id, color:colorOfPlayer(i), piece, progress:-1
      }))),
      turn:0, dice:null, rolled:false, winner:null, log:['A partida começou!'], serial:1
    };
  }
  function globalIndex(piece){
    if(piece.progress < 0 || piece.progress > 51) return null;
    return (START_OFFSET[piece.color] + piece.progress) % PATH.length;
  }
  function coordForPiece(piece){
    if(piece.progress === -1) return YARDS[piece.color][piece.piece];
    if(piece.progress >= 0 && piece.progress <= 51) return PATH[globalIndex(piece)];
    if(piece.progress >= 52 && piece.progress <= 57) return LANES[piece.color][piece.progress-52];
    if(piece.progress === 58) return [7,7];
    return YARDS[piece.color][piece.piece];
  }
  function isFinished(piece){ return piece.progress === 58; }
  function piecesForPlayer(game, playerId){ return game.pieces.filter(p=>p.playerId===playerId); }
  function playerById(game,id){ return game.players.find(p=>p.id===id); }
  function currentPlayer(game){ return game.players[game.turn]; }
  function canMovePiece(piece,dice){
    if(isFinished(piece)) return false;
    if(piece.progress === -1) return dice === 6;
    return piece.progress + dice <= 58;
  }
  function movablePieces(game){
    if(!game.rolled || !game.dice || game.winner) return [];
    const current=currentPlayer(game);
    if(!current) return [];
    return piecesForPlayer(game,current.id).filter(p=>canMovePiece(p,game.dice));
  }
  function nextTurn(game){
    if(game.players.length < 2) return;
    let tries=0;
    do{ game.turn=(game.turn+1)%game.players.length; tries++; }
    while(game.players[game.turn]?.finished && tries<game.players.length+1);
    game.dice=null; game.rolled=false; game.serial++;
  }
  function roll(game,playerId,forcedValue){
    if(game.phase!=='playing' || game.winner) return {ok:false,error:'A partida terminou.'};
    if(currentPlayer(game)?.id!==playerId) return {ok:false,error:'Não é sua vez.'};
    if(game.rolled) return {ok:false,error:'Você já jogou o dado.'};
    const dice=forcedValue || (Math.floor(Math.random()*6)+1);
    game.dice=dice; game.rolled=true; game.serial++;
    const name=currentPlayer(game).name;
    game.log.unshift(`${name} tirou ${dice}.`);
    if(movablePieces(game).length===0){
      game.log.unshift(`${name} não tem jogada disponível.`);
      if(dice===6){ game.dice=null; game.rolled=false; game.serial++; }
      else nextTurn(game);
    }
    return {ok:true,dice};
  }
  function captureAt(game,movedPiece){
    if(movedPiece.progress < 0 || movedPiece.progress > 51) return 0;
    const gi=globalIndex(movedPiece);
    if(SAFE_GLOBAL.has(gi)) return 0;
    let captured=0;
    for(const p of game.pieces){
      if(p.id===movedPiece.id || p.color===movedPiece.color) continue;
      if(p.progress>=0 && p.progress<=51 && globalIndex(p)===gi){ p.progress=-1; captured++; }
    }
    return captured;
  }
  function move(game,playerId,pieceId){
    if(!game.rolled || !game.dice) return {ok:false,error:'Jogue o dado primeiro.'};
    if(currentPlayer(game)?.id!==playerId) return {ok:false,error:'Não é sua vez.'};
    const piece=game.pieces.find(p=>p.id===pieceId && p.playerId===playerId);
    if(!piece || !canMovePiece(piece,game.dice)) return {ok:false,error:'Movimento inválido.'};
    const rolled=game.dice;
    if(piece.progress===-1) piece.progress=0; else piece.progress += rolled;
    const player=playerById(game,playerId);
    const captured=captureAt(game,piece);
    if(captured) game.log.unshift(`${player.name} capturou ${captured} peça${captured>1?'s':''}!`);
    if(piece.progress===58) game.log.unshift(`${player.name} colocou uma peça na chegada!`);
    const allHome=piecesForPlayer(game,playerId).every(isFinished);
    if(allHome){
      player.finished=true; game.winner=playerId; game.phase='finished';
      game.log.unshift(`🏆 ${player.name} venceu a partida!`);
      game.dice=null; game.rolled=false; game.serial++;
      return {ok:true,captured,won:true};
    }
    if(rolled===6){
      game.dice=null; game.rolled=false; game.serial++;
      game.log.unshift(`${player.name} joga novamente por ter tirado 6.`);
    } else nextTurn(game);
    return {ok:true,captured,won:false};
  }
  window.LudoEngine={COLORS,COLOR_LABELS,PATH,LANES,YARDS,START_OFFSET,SAFE_GLOBAL,newGame,coordForPiece,currentPlayer,movablePieces,roll,move,piecesForPlayer};
})();

(() => {
  const $ = s => document.querySelector(s);
  const els = {
    home:$('#homeView'), lobby:$('#lobbyView'), game:$('#gameView'),
    loadingTitle:$('#loadingTitle'), loadingText:$('#loadingText'), badge:$('#connectionBadge'),
    roomCode:$('#roomCodeText'), inviteLink:$('#inviteLink'), copyCode:$('#copyCodeBtn'), copyLink:$('#copyLinkBtn'), share:$('#shareBtn'),
    lobbyPlayers:$('#lobbyPlayers'), playerCount:$('#playerCount'), start:$('#startGameBtn'), lobbyHint:$('#lobbyHint'),
    board:$('#board'), turnTitle:$('#turnTitle'), gameRoomCode:$('#gameRoomCode'), dice:$('#dice'), roll:$('#rollBtn'), hint:$('#actionHint'), score:$('#scoreList'), log:$('#gameLog'), roundBadge:$('#roundBadge'),
    gameInvite:$('#gameInviteBtn'), inviteModal:$('#inviteModal'), closeInviteModal:$('#closeInviteModal'), gameInviteLink:$('#gameInviteLink'), gameShare:$('#gameShareBtn'),
    toast:$('#toast'), sound:$('#soundBtn')
  };

  const DICE_CHARS=['⚀','⚁','⚂','⚃','⚄','⚅'];
  let socket=null;
  let isHost=false, roomCode='', myId='', state=null, soundOn=true;
  let reconnectTimer=null, heartbeatTimer=null, guestRetryTimer=null;
  let reconnectAttempts=0, joinedRelay=false;

  function randomCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
  function playerId(){ return 'p-'+Math.random().toString(36).slice(2,10); }
  function cleanCode(code){ return (code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12); }
  function showView(name){ [els.home,els.lobby,els.game].forEach(v=>v?.classList.remove('active')); els[name]?.classList.add('active'); }
  function toast(msg){ if(!els.toast) return; els.toast.textContent=msg; els.toast.classList.remove('hidden'); setTimeout(()=>els.toast.classList.add('hidden'),1800); }
  function setBadge(text,online=true){ if(!els.badge) return; els.badge.textContent=text; els.badge.classList.toggle('muted',!online); }
  function setLoading(title,text){ if(els.loadingTitle) els.loadingTitle.textContent=title; if(els.loadingText) els.loadingText.textContent=text; }
  function inviteUrl(){ const u=new URL(location.href); u.search=''; u.hash=''; u.searchParams.set('room',roomCode); return u.toString(); }
  function shareText(){ return `Vem jogar Ludo comigo! 🎲\nSala: ${roomCode}\n${inviteUrl()}`; }
  function socketUrl(){ return `${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/ws`; }
  function isSocketOpen(){ return socket && socket.readyState===WebSocket.OPEN; }

  function beep(freq=520,duration=.08){
    if(!soundOn) return;
    try{
      const ac=new (window.AudioContext||window.webkitAudioContext)();
      const o=ac.createOscillator(),g=ac.createGain();
      o.frequency.value=freq; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(.05,ac.currentTime); g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);
      o.start(); o.stop(ac.currentTime+duration);
    }catch(e){}
  }

  function saveHostState(){
    if(!isHost || !state || !roomCode) return;
    try{ sessionStorage.setItem('ludo-host-state-'+roomCode,JSON.stringify(state)); }catch(e){}
  }

  function sendRaw(message){
    if(!isSocketOpen()) return false;
    try{ socket.send(JSON.stringify(message)); return true; }catch(e){ return false; }
  }

  function sendRoom(message){ return sendRaw({...message,room:roomCode}); }

  function stopTimers(){
    if(heartbeatTimer){ clearInterval(heartbeatTimer); heartbeatTimer=null; }
    if(guestRetryTimer){ clearInterval(guestRetryTimer); guestRetryTimer=null; }
  }

  function startHeartbeat(){
    if(heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer=setInterval(()=>{
      if(isSocketOpen()) sendRaw({type:'ping',at:Date.now()});
      else ensureSocket();
    },12000);
  }

  function startGuestRetry(){
    if(isHost) return;
    if(guestRetryTimer) clearInterval(guestRetryTimer);
    guestRetryTimer=setInterval(()=>{
      if(isSocketOpen() && joinedRelay){
        sendRoom({type:'join-player',player:{id:myId}});
        sendRoom({type:'request-state',playerId:myId});
      }
    },5000);
  }

  function scheduleReconnect(){
    if(reconnectTimer) return;
    const delay=Math.min(700*Math.pow(1.7,reconnectAttempts++),7000);
    reconnectTimer=setTimeout(()=>{
      reconnectTimer=null;
      connectSocket();
    },delay);
  }

  function ensureSocket(){
    if(isSocketOpen() || socket?.readyState===WebSocket.CONNECTING) return;
    connectSocket();
  }

  function connectSocket(){
    if(socket?.readyState===WebSocket.OPEN || socket?.readyState===WebSocket.CONNECTING) return;
    joinedRelay=false;
    setBadge(reconnectAttempts ? 'reconectando...' : 'conectando...',false);
    try{ socket?.close(); }catch(e){}

    try{
      const ws=new WebSocket(socketUrl());
      socket=ws;

      ws.addEventListener('open',()=>{
        if(socket!==ws) return;
        reconnectAttempts=0;
        setBadge('online',true);
        sendRaw({type:'relay-join',room:roomCode,clientId:myId,role:isHost?'host':'guest'});
        startHeartbeat();
      });

      ws.addEventListener('message',(event)=>{
        if(socket!==ws) return;
        let msg;
        try{ msg=JSON.parse(event.data); }catch{ return; }
        handleSocketMessage(msg);
      });

      ws.addEventListener('close',()=>{
        if(socket!==ws) return;
        joinedRelay=false;
        setBadge('reconectando...',false);
        if(!isHost && !state) setLoading('Aguardando conexão...','A sala vai reconectar automaticamente.');
        scheduleReconnect();
      });

      ws.addEventListener('error',()=>{
        if(socket!==ws) return;
        setBadge('reconectando...',false);
      });
    }catch(e){
      scheduleReconnect();
    }
  }

  function handleSocketMessage(msg){
    if(!msg || typeof msg!=='object') return;
    if(msg.type==='pong' || msg.type==='relay-ready') return;

    if(msg.type==='relay-joined'){
      joinedRelay=true;
      setBadge('online',true);
      if(isHost){
        sendRoom({type:'host-online',hostId:myId});
        broadcastState();
      } else {
        sendRoom({type:'join-player',player:{id:myId}});
        sendRoom({type:'request-state',playerId:myId});
        startGuestRetry();
        setTimeout(()=>{
          if(!state){
            setLoading('Aguardando o Jogador 1...','Deixe esta tela aberta. Assim que ele voltar ao jogo, você entra automaticamente.');
          }
        },3500);
      }
      return;
    }

    if(msg.room && cleanCode(msg.room)!==roomCode) return;

    if(msg.type==='presence'){
      if(!isHost && msg.event==='joined' && msg.role==='host'){
        sendRoom({type:'join-player',player:{id:myId}});
        sendRoom({type:'request-state',playerId:myId});
      }
      if(isHost && msg.event==='joined') broadcastState();
      return;
    }

    if(msg.type==='host-online'){
      if(!isHost){
        sendRoom({type:'join-player',player:{id:myId}});
        sendRoom({type:'request-state',playerId:myId});
      }
      return;
    }

    if(msg.type==='join-player'){
      if(isHost) handleJoinPlayer(msg.player);
      return;
    }

    if(msg.type==='request-state'){
      if(isHost) broadcastState();
      return;
    }

    if(msg.type==='state' && !isHost){
      if(!msg.state) return;
      state=msg.state;
      if(state.roomCode && cleanCode(state.roomCode)!==roomCode) return;
      const me=state.players?.find(p=>p.id===myId);
      if(!me && state.phase!=='lobby'){
        setLoading('A partida já começou','Esse convite não aceita novos jogadores agora.');
        showView('home');
        return;
      }
      if(state.phase==='lobby') enterLobby(); else enterGame();
      return;
    }

    if(msg.type==='player-error' && !isHost && (!msg.targetId || msg.targetId===myId)){
      setLoading('Não foi possível entrar',msg.message||'Sala indisponível.');
      showView('home');
      return;
    }

    if(msg.type==='action' && isHost && state?.phase==='playing'){
      processAction(msg.playerId,msg.action,msg.payload||{});
    }
  }

  function createRoom(){
    isHost=true;
    myId=sessionStorage.getItem('ludo-host-id') || playerId();
    sessionStorage.setItem('ludo-host-id',myId);
    roomCode=randomCode();
    state={phase:'lobby',roomCode,players:[{id:myId,name:'Jogador 1',host:true,color:'red'}],serial:1};
    saveHostState();
    setLoading('Criando sua sala...','Conectando ao servidor da Vercel.');
    connectSocket();
    enterLobby();
  }

  function joinRoom(code){
    isHost=false;
    roomCode=cleanCode(code);
    const idKey='ludo-player-id-'+roomCode;
    myId=sessionStorage.getItem(idKey)||playerId();
    sessionStorage.setItem(idKey,myId);
    setLoading('Entrando na partida...','Conectando você automaticamente.');
    showView('home');
    connectSocket();
  }

  function handleJoinPlayer(player){
    if(!isHost || !state || !player?.id) return;
    const id=String(player.id);
    const existing=state.players?.find(p=>p.id===id);
    if(existing){ broadcastState(); return; }

    if(state.phase!=='lobby'){
      sendRoom({type:'player-error',targetId:id,message:'Essa partida já começou.'});
      return;
    }
    if(state.players.length>=4){
      sendRoom({type:'player-error',targetId:id,message:'A sala está cheia.'});
      return;
    }

    const usedNames=new Set(state.players.map(p=>p.name));
    let automaticName='Jogador 2';
    for(let n=2;n<=4;n++) if(!usedNames.has(`Jogador ${n}`)){ automaticName=`Jogador ${n}`; break; }
    state.players.push({id,name:automaticName,host:false,color:LudoEngine.COLORS[state.players.length]});
    state.serial=(state.serial||0)+1;
    saveHostState();
    broadcastState();
    renderLobby();
    beep(680);
  }

  function broadcastState(){
    if(!isHost || !state) return;
    state.roomCode=roomCode;
    saveHostState();
    sendRoom({type:'state',state});
  }

  function enterLobby(){
    showView('lobby');
    if(els.roomCode) els.roomCode.textContent=roomCode;
    if(els.inviteLink) els.inviteLink.value=inviteUrl();
    if(els.gameInviteLink) els.gameInviteLink.value=inviteUrl();
    renderLobby();
  }

  function renderLobby(){
    if(!state) return;
    els.playerCount.textContent=`${state.players.length}/4`;
    els.lobbyPlayers.innerHTML=state.players.map((p,i)=>`
      <div class="player-row"><div class="player-meta"><span class="player-dot" style="background:${cssColor(p.color||LudoEngine.COLORS[i])}"></span><div><div class="player-name">${escapeHtml(p.name)}${p.id===myId?' (você)':''}</div><div class="player-label">${p.host?'Dono da sala':'Convidado'}</div></div></div><span>${p.host?'👑':'✓'}</span></div>`).join('');
    els.start.style.display=isHost?'block':'none';
    els.start.disabled=state.players.length<2;
    els.lobbyHint.textContent=isHost ? (state.players.length<2?'Aguardando pelo menos mais 1 jogador...':'Tudo pronto. Você já pode iniciar!') : 'Aguardando o Jogador 1 iniciar a partida...';
  }

  function startGame(){
    if(!isHost || !state || state.players.length<2) return;
    state=LudoEngine.newGame(state.players);
    state.roomCode=roomCode;
    saveHostState();
    broadcastState();
    enterGame();
    beep(740,.12);
  }

  function enterGame(){
    showView('game');
    els.gameRoomCode.textContent=roomCode;
    buildBoard();
    renderGame();
  }

  function buildBoard(){
    els.board.innerHTML='';
    for(let r=0;r<15;r++) for(let c=0;c<15;c++){
      const cell=document.createElement('div'); cell.className='cell'; cell.dataset.r=r; cell.dataset.c=c;
      const onPath=LudoEngine.PATH.some(([rr,cc])=>rr===r&&cc===c);
      if(onPath) cell.classList.add('track');
      if(r<=5&&c<=5) cell.classList.add('home-red');
      if(r<=5&&c>=9) cell.classList.add('home-green');
      if(r>=9&&c>=9) cell.classList.add('home-yellow');
      if(r>=9&&c<=5) cell.classList.add('home-blue');
      for(const color of LudoEngine.COLORS){
        if(LudoEngine.LANES[color].some(([rr,cc])=>rr===r&&cc===c)) cell.classList.add('lane-'+color);
      }
      for(const [color,offset] of Object.entries(LudoEngine.START_OFFSET)){
        const [rr,cc]=LudoEngine.PATH[offset]; if(rr===r&&cc===c) cell.classList.add('start-'+color,'safe');
      }
      const gi=LudoEngine.PATH.findIndex(([rr,cc])=>rr===r&&cc===c);
      if(LudoEngine.SAFE_GLOBAL.has(gi)) cell.classList.add('safe');
      els.board.appendChild(cell);
    }
    const center=document.createElement('div'); center.className='center-home'; els.board.appendChild(center);
  }

  function renderGame(){
    if(!state || state.phase==='lobby') return;
    const current=LudoEngine.currentPlayer(state);
    const mine=current?.id===myId;
    els.turnTitle.textContent=state.winner ? `${playerName(state.winner)} venceu! 🏆` : (mine ? 'Sua vez!' : `Vez de ${current?.name||''}`);
    els.roundBadge.textContent=state.winner?'Finalizada':'Em jogo';
    els.dice.textContent=state.dice?DICE_CHARS[state.dice-1]:'⚄';
    els.roll.disabled=!!state.winner || !mine || state.rolled || !isSocketOpen();
    if(state.winner) els.hint.textContent=`${playerName(state.winner)} levou as 4 peças para a chegada.`;
    else if(!isSocketOpen()) els.hint.textContent='Reconectando... sua partida está preservada.';
    else if(mine && !state.rolled) els.hint.textContent='Jogue o dado.';
    else if(mine && state.rolled) els.hint.textContent='Escolha uma peça destacada.';
    else els.hint.textContent='Aguarde sua vez.';

    els.score.innerHTML=state.players.map(p=>{
      const home=LudoEngine.piecesForPlayer(state,p.id).filter(x=>x.progress===58).length;
      return `<div class="score-row ${current?.id===p.id&&!state.winner?'active':''}"><div class="score-info"><span class="player-dot" style="background:${cssColor(p.color)}"></span><strong>${escapeHtml(p.name)}${p.id===myId?' (você)':''}</strong></div><span class="score-home">${home}/4 🏠</span></div>`;
    }).join('');
    els.log.innerHTML=(state.log||[]).slice(0,12).map(x=>`<div class="log-line">${escapeHtml(x)}</div>`).join('');
    renderPieces();
  }

  function renderPieces(){
    els.board.querySelectorAll('.piece').forEach(x=>x.remove());
    if(!state?.pieces) return;
    const movable=new Set((LudoEngine.movablePieces(state)||[]).map(p=>p.id));
    const groups={};
    state.pieces.forEach(p=>{ const [r,c]=LudoEngine.coordForPiece(p); const k=`${r},${c}`; (groups[k] ||= []).push(p); });
    Object.values(groups).forEach(group=>group.forEach((p,idx)=>{
      const [r,c]=LudoEngine.coordForPiece(p);
      const el=document.createElement('button'); el.className=`piece ${p.color}`; el.type='button';
      const spread=group.length>1 ? 1.1 : 0; const angle=(Math.PI*2*idx)/group.length;
      el.style.left=(((c+.5)/15)*100 + Math.cos(angle)*spread)+'%';
      el.style.top=(((r+.5)/15)*100 + Math.sin(angle)*spread)+'%';
      el.title=`Peça ${p.piece+1}`;
      if(p.playerId===myId && movable.has(p.id) && !state.winner && isSocketOpen()){
        el.classList.add('movable');
        el.addEventListener('click',()=>sendAction('move',{pieceId:p.id}));
      }
      els.board.appendChild(el);
    }));
  }

  function processAction(pid,action,payload){
    if(!isHost || !state) return;
    if(action==='roll'){
      const r=LudoEngine.roll(state,pid);
      if(r.ok){ saveHostState(); broadcastState(); renderGame(); animateDice(r.dice); }
    } else if(action==='move'){
      const r=LudoEngine.move(state,pid,payload.pieceId);
      if(r.ok){ saveHostState(); broadcastState(); renderGame(); beep(r.won?880:r.captured?710:500,.1); }
    }
  }

  function sendAction(action,payload={}){
    if(!isSocketOpen()){
      toast('Reconectando. Tente novamente em alguns segundos.');
      ensureSocket();
      return;
    }
    if(isHost) return processAction(myId,action,payload);
    sendRoom({type:'action',playerId:myId,action,payload});
  }

  function animateDice(value){
    els.dice.classList.remove('rolling'); void els.dice.offsetWidth; els.dice.classList.add('rolling');
    setTimeout(()=>{ if(value) els.dice.textContent=DICE_CHARS[value-1]; },220);
  }
  function playerName(id){ return state?.players?.find(p=>p.id===id)?.name||'Jogador'; }
  function cssColor(c){ return ({red:'#ff4d5e',green:'#21c16b',yellow:'#f5c941',blue:'#4285ff'})[c]||'#999'; }
  function escapeHtml(s){ return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m])); }

  async function copy(text){
    try{ await navigator.clipboard.writeText(text); toast('Copiado!'); }
    catch{
      const t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); toast('Copiado!');
    }
  }
  async function share(){
    if(navigator.share){
      try{ await navigator.share({title:'Ludo Friends',text:'Vem jogar Ludo comigo! 🎲',url:inviteUrl()}); }catch{}
    } else copy(shareText());
  }

  els.start.onclick=startGame;
  els.roll.onclick=()=>sendAction('roll');
  els.copyCode.onclick=()=>copy(roomCode);
  els.copyLink.onclick=()=>copy(inviteUrl());
  els.share.onclick=share;
  els.gameInvite.onclick=()=>{ els.gameInviteLink.value=inviteUrl(); els.inviteModal.classList.remove('hidden'); };
  els.closeInviteModal.onclick=()=>els.inviteModal.classList.add('hidden');
  els.gameShare.onclick=share;
  els.sound.onclick=()=>{ soundOn=!soundOn; els.sound.textContent=soundOn?'🔊':'🔇'; };

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible') return;
    ensureSocket();
    if(isHost && state) setTimeout(broadcastState,500);
    if(!isHost && joinedRelay) setTimeout(()=>sendRoom({type:'join-player',player:{id:myId}}),500);
    if(state?.phase && state.phase!=='lobby') renderGame();
  });
  window.addEventListener('online',()=>{ ensureSocket(); });
  window.addEventListener('offline',()=>{ setBadge('sem internet',false); });

  const roomParam=cleanCode(new URLSearchParams(location.search).get('room'));
  if(roomParam) joinRoom(roomParam); else createRoom();
})();
