(function(){
  const COLORS=['red','blue'];
  const DIRS=[[-1,-1],[-1,1],[1,-1],[1,1]];
  const inside=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
  const currentPlayer=g=>g.players[g.turn];
  const piecesForPlayer=(g,id)=>g.pieces.filter(p=>p.playerId===id);
  const pieceAt=(g,r,c)=>g.pieces.find(p=>p.r===r&&p.c===c);
  function newGame(players){
    const mapped=players.map((p,i)=>({...p,color:COLORS[i]}));
    const pieces=[]; let n=0;
    for(let r=0;r<3;r++)for(let c=0;c<8;c++)if((r+c)%2===1)pieces.push({id:`${players[1].id}-${n++}`,playerId:players[1].id,color:'blue',r,c,king:false});
    n=0;
    for(let r=5;r<8;r++)for(let c=0;c<8;c++)if((r+c)%2===1)pieces.push({id:`${players[0].id}-${n++}`,playerId:players[0].id,color:'red',r,c,king:false});
    return {game:'checkers',phase:'playing',players:mapped,pieces,turn:0,winner:null,mustContinuePieceId:null,log:['A partida de Dama começou!']};
  }
  function captureMovesForPiece(g,p){
    const moves=[];
    for(const [dr,dc] of DIRS){
      const mr=p.r+dr,mc=p.c+dc,tr=p.r+dr*2,tc=p.c+dc*2;
      if(!inside(tr,tc))continue;
      const middle=pieceAt(g,mr,mc);
      if(middle&&middle.playerId!==p.playerId&&!pieceAt(g,tr,tc))moves.push({pieceId:p.id,fromR:p.r,fromC:p.c,toR:tr,toC:tc,captureId:middle.id});
    }
    return moves;
  }
  function simpleMovesForPiece(g,p){
    const dirs=p.king?DIRS:(p.color==='red'?[[-1,-1],[-1,1]]:[[1,-1],[1,1]]);
    const moves=[];
    for(const [dr,dc] of dirs){const r=p.r+dr,c=p.c+dc;if(inside(r,c)&&!pieceAt(g,r,c))moves.push({pieceId:p.id,fromR:p.r,fromC:p.c,toR:r,toC:c,captureId:null});}
    return moves;
  }
  function legalMoves(g,playerId){
    if(g.winner)return [];
    const own=piecesForPlayer(g,playerId);
    if(g.mustContinuePieceId){const p=own.find(x=>x.id===g.mustContinuePieceId);return p?captureMovesForPiece(g,p):[];}
    const captures=own.flatMap(p=>captureMovesForPiece(g,p));
    if(captures.length)return captures;
    return own.flatMap(p=>simpleMovesForPiece(g,p));
  }
  function movesForPiece(g,playerId,pieceId){return legalMoves(g,playerId).filter(m=>m.pieceId===pieceId);}
  function promote(p){if(!p.king&&((p.color==='red'&&p.r===0)||(p.color==='blue'&&p.r===7))){p.king=true;return true;}return false;}
  function finishIfNeeded(g,lastPlayerId){
    const opponent=g.players.find(p=>p.id!==lastPlayerId);
    if(!opponent)return false;
    if(piecesForPlayer(g,opponent.id).length===0||legalMoves(g,opponent.id).length===0){g.winner=lastPlayerId;g.phase='finished';g.mustContinuePieceId=null;g.log.unshift(`🏆 ${g.players.find(p=>p.id===lastPlayerId)?.name||'Jogador'} venceu!`);return true;}
    return false;
  }
  function move(g,playerId,pieceId,toR,toC){
    if(g.winner)return {ok:false,error:'A partida terminou.'};
    if(currentPlayer(g)?.id!==playerId)return {ok:false,error:'Não é sua vez.'};
    const allowed=legalMoves(g,playerId).find(m=>m.pieceId===pieceId&&m.toR===toR&&m.toC===toC);
    if(!allowed)return {ok:false,error:'Movimento inválido.'};
    const piece=g.pieces.find(p=>p.id===pieceId); if(!piece)return {ok:false,error:'Peça não encontrada.'};
    piece.r=toR;piece.c=toC;
    let captured=false;
    if(allowed.captureId){g.pieces=g.pieces.filter(p=>p.id!==allowed.captureId);captured=true;g.log.unshift(`${currentPlayer(g).name} capturou uma peça.`);}
    const crowned=promote(piece); if(crowned)g.log.unshift(`👑 ${currentPlayer(g).name} fez uma dama!`);
    if(captured){
      const more=captureMovesForPiece(g,piece);
      if(more.length){g.mustContinuePieceId=piece.id;g.log.unshift(`${currentPlayer(g).name} deve continuar capturando.`);return {ok:true,captured:true,continue:true,crowned};}
    }
    g.mustContinuePieceId=null;
    const last=playerId;g.turn=(g.turn+1)%g.players.length;
    const won=finishIfNeeded(g,last);
    return {ok:true,captured,continue:false,crowned,won};
  }
  window.DamaEngine={newGame,currentPlayer,piecesForPlayer,pieceAt,legalMoves,movesForPiece,move,captureMovesForPiece};
})();

(()=>{
  const $=s=>document.querySelector(s);
  const els={
    mode:$('#modeView'),lobby:$('#lobbyView'),game:$('#gameView'),friendMode:$('#friendModeBtn'),botMode:$('#botModeBtn'),localMode:$('#localModeBtn'),
    back:$('#backBtn'),newGame:$('#newGameBtn'),cancelLobby:$('#cancelLobbyBtn'),share:$('#shareBtn'),copy:$('#copyBtn'),
    lobbyTitle:$('#lobbyTitle'),lobbyText:$('#lobbyText'),lobbyStatus:$('#lobbyStatus'),roomCode:$('#roomCode'),inviteLink:$('#inviteLink'),
    gameModeLabel:$('#gameModeLabel'),turnTitle:$('#turnTitle'),board:$('#board'),hint:$('#actionHint'),score:$('#scoreList'),log:$('#gameLog'),roundBadge:$('#roundBadge'),sound:$('#soundBtn'),toast:$('#toast'),badge:$('#connectionBadge'),
    socialCard:$('#socialCard'),chatMessages:$('#chatMessages'),chatForm:$('#chatForm'),chatInput:$('#chatInput'),chatSend:$('#chatSendBtn'),chatDot:$('#chatOnlineDot'),
    voiceBtn:$('#voiceBtn'),muteBtn:$('#muteBtn'),voiceStatus:$('#voiceStatus'),remoteAudio:$('#remoteAudio')
  };
  const HUMAN_ID='player1',BOT_ID='bot',HUMAN2_ID='player2',HOST_ID='player1',GUEST_ID='player2';
  const ICE_CONFIG={iceServers:[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}
  ]};
  let state=null,mode='menu',soundOn=true,busy=false,selectedPieceId=null,botTimer=null;
  let peer=null,conn=null,roomCode='',inviteUrl='',reconnectTimer=null,onlineStarted=false;
  let chatHistory=[];
  let localAudioStream=null,currentCall=null,remoteVoiceReady=false,voiceEnabled=false,micMuted=false,voiceLinked=false,voiceRetryTimer=null;

  function showView(name){[els.mode,els.lobby,els.game].forEach(v=>v?.classList.remove('active'));els[name]?.classList.add('active');}
  function toast(msg){els.toast.textContent=msg;els.toast.classList.remove('hidden');clearTimeout(toast._t);toast._t=setTimeout(()=>els.toast.classList.add('hidden'),2200);}
  function beep(freq=520,duration=.08){if(!soundOn)return;try{const ac=new(window.AudioContext||window.webkitAudioContext)(),o=ac.createOscillator(),g=ac.createGain();o.frequency.value=freq;o.connect(g);g.connect(ac.destination);g.gain.setValueAtTime(.05,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);o.start();o.stop(ac.currentTime+duration);}catch{}}
  function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]));}
  function cssColor(c){return c==='red'?'#ff5263':'#4b8cff';}
  function isOnline(){return mode==='friend-host'||mode==='friend-guest';}
  function myOnlineId(){return mode==='friend-host'?HOST_ID:GUEST_ID;}
  function currentId(){return state?DamaEngine.currentPlayer(state)?.id:null;}
  function isBotTurn(){return mode==='bot'&&currentId()===BOT_ID&&!state?.winner;}
  function canAct(){if(!state||state.winner||busy)return false;if(mode==='local')return true;if(mode==='bot')return currentId()===HUMAN_ID;if(isOnline())return currentId()===myOnlineId()&&!!conn?.open;return false;}
  function clearBotTimer(){if(botTimer){clearTimeout(botTimer);botTimer=null;}}
  function setConnectionBadge(text,ok=false){els.badge.textContent=text;els.badge.classList.toggle('status-ready',ok);}
  function playerName(id){return state?.players?.find(p=>p.id===id)?.name||'Jogador';}

  function startBotGame(){cleanupOnline(false);clearBotTimer();mode='bot';busy=false;selectedPieceId=null;state=DamaEngine.newGame([{id:HUMAN_ID,name:'Você'},{id:BOT_ID,name:'Robô 🤖'}]);els.gameModeLabel.textContent='DAMA • CONTRA O ROBÔ';setConnectionBadge('offline • robô',true);els.newGame.style.display='';showView('game');render();}
  function startLocalGame(){cleanupOnline(false);clearBotTimer();mode='local';busy=false;selectedPieceId=null;state=DamaEngine.newGame([{id:HUMAN_ID,name:'Jogador 1'},{id:HUMAN2_ID,name:'Jogador 2'}]);els.gameModeLabel.textContent='DAMA • 2 JOGADORES';setConnectionBadge('offline • local',true);els.newGame.style.display='';showView('game');render();}

  function randomRoom(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let r='';for(let i=0;i<6;i++)r+=chars[Math.floor(Math.random()*chars.length)];return r;}
  function hostPeerId(code){return 'dama-friends-'+code.toLowerCase();}
  function setLobbyStatus(text,type=''){els.lobbyStatus.className='connection-state'+(type?' '+type:'');els.lobbyStatus.querySelector('span').textContent=text;}
  function createPeer(id){if(typeof Peer==='undefined'){setLobbyStatus('Não foi possível carregar a conexão online.','error');return null;}return new Peer(id||undefined,{debug:0,config:ICE_CONFIG});}
  function bindPeerCommon(p,role){
    p.on('disconnected',()=>{setConnectionBadge('reconectando...');setLobbyStatus('Reconectando...');try{p.reconnect();}catch{}scheduleReconnect(role);});
    p.on('close',()=>{setConnectionBadge('desconectado');scheduleReconnect(role);});
    p.on('error',err=>{console.warn('Peer error',err);if(err?.type==='peer-unavailable'&&role==='guest'){setLobbyStatus('Sala ainda não disponível. Tentando novamente...');scheduleReconnect(role,1200);return;}setLobbyStatus('Reconectando...');scheduleReconnect(role,1600);});
    p.on('call',call=>handleIncomingCall(call));
  }
  function scheduleReconnect(role,delay=1000){clearTimeout(reconnectTimer);reconnectTimer=setTimeout(()=>{if(role==='host'&&mode==='friend-host')setupHost(roomCode);if(role==='guest'&&mode==='friend-guest')setupGuest(roomCode);},delay);}
  function closeCurrentCall(){clearTimeout(voiceRetryTimer);voiceRetryTimer=null;voiceLinked=false;try{currentCall?.close();}catch{}currentCall=null;if(els.remoteAudio)els.remoteAudio.srcObject=null;updateVoiceUI();}
  function closePeerOnly(){clearTimeout(reconnectTimer);reconnectTimer=null;closeCurrentCall();remoteVoiceReady=false;try{conn?.close();}catch{}conn=null;try{peer?.destroy();}catch{}peer=null;updateSocialConnection();}
  function stopVoice(sendSignal=true){if(sendSignal&&conn?.open){try{conn.send({type:'voice-ready',ready:false});}catch{}}voiceEnabled=false;micMuted=false;remoteVoiceReady=false;closeCurrentCall();try{localAudioStream?.getTracks().forEach(t=>t.stop());}catch{}localAudioStream=null;updateVoiceUI();}
  function cleanupOnline(clearUrl=true){stopVoice(false);closePeerOnly();onlineStarted=false;chatHistory=[];renderChat();if(clearUrl&&isOnline())history.replaceState({},'',location.pathname);}
  function startFriendHost(code){clearBotTimer();cleanupOnline(false);mode='friend-host';roomCode=code||randomRoom();inviteUrl=`${location.origin}${location.pathname}?room=${encodeURIComponent(roomCode)}`;history.replaceState({},'',`${location.pathname}?host=${encodeURIComponent(roomCode)}`);els.roomCode.textContent=roomCode;els.inviteLink.textContent=inviteUrl;els.lobbyTitle.textContent='Sala de Dama criada';els.lobbyText.textContent='Envie o link para seu amigo. Quando ele entrar, a partida começa automaticamente.';els.share.style.display='';els.copy.style.display='';setConnectionBadge('criando sala...');setLobbyStatus('Preparando sala...');showView('lobby');setupHost(code);}
  function setupHost(code){closePeerOnly();mode='friend-host';peer=createPeer(hostPeerId(code));if(!peer)return;bindPeerCommon(peer,'host');peer.on('open',()=>{setConnectionBadge('online • aguardando',true);setLobbyStatus('Sala pronta. Aguardando seu amigo...','connected');});peer.on('connection',c=>{if(conn?.open){try{c.close();}catch{}return;}conn=c;bindConnection(c,'host');});}
  function startFriendGuest(code){clearBotTimer();cleanupOnline(false);mode='friend-guest';roomCode=code;history.replaceState({},'',`${location.pathname}?room=${encodeURIComponent(code)}`);els.roomCode.textContent=code;els.inviteLink.textContent='Entrando na sala...';els.lobbyTitle.textContent='Entrando na Dama';els.lobbyText.textContent='Conectando com seu amigo...';els.share.style.display='none';els.copy.style.display='none';setConnectionBadge('conectando...');setLobbyStatus('Procurando a sala...');showView('lobby');setupGuest(code);}
  function setupGuest(code){closePeerOnly();mode='friend-guest';peer=createPeer();if(!peer)return;bindPeerCommon(peer,'guest');peer.on('open',()=>{setConnectionBadge('conectando...');connectToHost(code);});}
  function connectToHost(code){if(!peer||peer.destroyed)return;try{conn=peer.connect(hostPeerId(code),{reliable:true,serialization:'json'});bindConnection(conn,'guest');}catch{scheduleReconnect('guest',1200);}}
  function bindConnection(c,role){
    let opened=false;
    c.on('open',()=>{opened=true;setConnectionBadge('online • conectado',true);setLobbyStatus('Amigo conectado! Iniciando partida...','connected');updateSocialConnection();try{c.send({type:'voice-ready',ready:voiceEnabled});}catch{}if(role==='host'){if(!state||!onlineStarted){state=DamaEngine.newGame([{id:HOST_ID,name:'Jogador 1'},{id:GUEST_ID,name:'Jogador 2'}]);onlineStarted=true;}sendState();enterOnlineGame();}else c.send({type:'hello'});});
    c.on('data',msg=>handleOnlineMessage(msg,role));
    c.on('close',()=>{setConnectionBadge('reconectando...');updateSocialConnection();closeCurrentCall();remoteVoiceReady=false;if(isOnline()){toast('Conexão caiu. Reconectando...');scheduleReconnect(role,800);}});
    c.on('error',()=>{updateSocialConnection();if(!opened)scheduleReconnect(role,1000);});
  }
  function handleOnlineMessage(msg,role){
    if(!msg||typeof msg!=='object')return;
    if(msg.type==='chat'){const clean=String(msg.text||'').trim().slice(0,280);if(clean)pushChat({from:msg.from===HOST_ID?HOST_ID:GUEST_ID,text:clean,ts:Number(msg.ts)||Date.now()});return;}
    if(msg.type==='chat-history'&&role==='guest'&&Array.isArray(msg.messages)){chatHistory=msg.messages.slice(-60).map(m=>({from:m.from===HOST_ID?HOST_ID:GUEST_ID,text:String(m.text||'').slice(0,280),ts:Number(m.ts)||Date.now()}));renderChat();return;}
    if(msg.type==='voice-ready'){remoteVoiceReady=!!msg.ready;if(!remoteVoiceReady)closeCurrentCall();updateVoiceUI();if(role==='host'&&remoteVoiceReady)maybeStartVoiceCall();return;}
    if(role==='host'){
      if(msg.type==='hello'){sendState();sendChatHistory();if(conn?.open)conn.send({type:'voice-ready',ready:voiceEnabled});if(state)enterOnlineGame();return;}
      if(msg.type==='action'&&msg.action==='move'&&state&&currentId()===GUEST_ID){const r=DamaEngine.move(state,GUEST_ID,msg.pieceId,Number(msg.toR),Number(msg.toC));if(r.ok){selectedPieceId=null;sendState();render();beep(r.captured?700:500);}}
      if(msg.type==='restart')startOnlineMatchHost();
    }else if(msg.type==='state'&&msg.state){state=msg.state;onlineStarted=true;selectedPieceId=null;enterOnlineGame();render();}
  }
  function sendState(){if(conn?.open&&state)conn.send({type:'state',state});}
  function sendChatHistory(){if(conn?.open)conn.send({type:'chat-history',messages:chatHistory.slice(-60)});}
  function enterOnlineGame(){if(!state)return;els.gameModeLabel.textContent='DAMA • ONLINE COM AMIGO';setConnectionBadge(conn?.open?'online • conectado':'reconectando...',!!conn?.open);els.newGame.style.display=mode==='friend-host'?'':'none';showView('game');render();renderChat();updateSocialConnection();updateVoiceUI();}
  function startOnlineMatchHost(){if(mode!=='friend-host')return;state=DamaEngine.newGame([{id:HOST_ID,name:'Jogador 1'},{id:GUEST_ID,name:'Jogador 2'}]);selectedPieceId=null;onlineStarted=true;sendState();enterOnlineGame();}
  function goMenu(){clearBotTimer();cleanupOnline(true);state=null;busy=false;selectedPieceId=null;mode='menu';setConnectionBadge('pronto',true);showView('mode');}

  function render(){
    if(!state)return;
    const current=DamaEngine.currentPlayer(state),botTurn=isBotTurn();
    els.socialCard.hidden=!isOnline();
    if(state.winner){els.turnTitle.textContent=`${playerName(state.winner)} venceu! 🏆`;els.roundBadge.textContent='Finalizada';els.hint.textContent='Partida encerrada.';}
    else{
      els.roundBadge.textContent=state.mustContinuePieceId?'Captura dupla':'Em jogo';
      if(mode==='bot')els.turnTitle.textContent=botTurn?'Vez do Robô 🤖':'Sua vez!';
      else if(isOnline())els.turnTitle.textContent=current?.id===myOnlineId()?'Sua vez!':`Vez de ${current?.name||''}`;
      else els.turnTitle.textContent=`Vez de ${current?.name||''}`;
      if(isOnline()&&!conn?.open)els.hint.textContent='Reconectando com seu amigo...';
      else if(botTurn)els.hint.textContent='O robô está pensando...';
      else if(state.mustContinuePieceId)els.hint.textContent=canAct()?'Continue a captura com a mesma peça.':'O adversário precisa continuar capturando.';
      else if(selectedPieceId)els.hint.textContent='Agora toque em uma casa destacada.';
      else els.hint.textContent=canAct()?'Escolha uma peça destacada. Capturas são obrigatórias.':'Aguarde sua vez.';
    }
    els.score.innerHTML=state.players.map(p=>{const left=DamaEngine.piecesForPlayer(state,p.id).length;const kings=DamaEngine.piecesForPlayer(state,p.id).filter(x=>x.king).length;return `<div class="score-row ${current?.id===p.id&&!state.winner?'active':''}"><div class="score-info"><span class="player-dot" style="background:${cssColor(p.color)}"></span><strong>${escapeHtml(p.name)}</strong></div><span class="score-home">${left} peças • ${kings} 👑</span></div>`;}).join('');
    els.log.innerHTML=(state.log||[]).slice(0,18).map(x=>`<div class="log-line">${escapeHtml(x)}</div>`).join('');
    renderBoard();updateSocialConnection();updateVoiceUI();if(botTurn&&!busy)scheduleBotTurn();
  }
  function renderBoard(){
    els.board.innerHTML='';
    const current=state?DamaEngine.currentPlayer(state):null;
    const legal=state&&current?DamaEngine.legalMoves(state,current.id):[];
    const movableIds=new Set(legal.map(m=>m.pieceId));
    if(selectedPieceId&&!movableIds.has(selectedPieceId))selectedPieceId=null;
    const targets=new Map();
    if(selectedPieceId)for(const m of legal.filter(x=>x.pieceId===selectedPieceId))targets.set(`${m.toR},${m.toC}`,m);
    els.board.classList.toggle('flipped',mode==='friend-guest');
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const cell=document.createElement('button');cell.type='button';cell.className=`checker-cell ${(r+c)%2?'dark':'light'}`;cell.dataset.r=r;cell.dataset.c=c;
      const target=targets.get(`${r},${c}`);if(target){cell.classList.add('legal-target');cell.addEventListener('click',()=>playMove(target));}
      const p=DamaEngine.pieceAt(state,r,c);
      if(p){
        const piece=document.createElement('span');piece.className=`checker-piece ${p.color}${p.king?' king':''}${selectedPieceId===p.id?' selected':''}`;piece.innerHTML=p.king?'<b>♛</b>':'';piece.title=p.king?'Dama':'Peça';
        const allowed=canAct()&&current?.id===p.playerId&&movableIds.has(p.id);
        if(allowed){piece.classList.add('movable');piece.addEventListener('click',e=>{e.stopPropagation();selectPiece(p.id);});}
        cell.appendChild(piece);
      }
      els.board.appendChild(cell);
    }
  }
  function selectPiece(pieceId){if(!canAct())return;const moves=DamaEngine.movesForPiece(state,currentId(),pieceId);if(!moves.length){toast('Escolha uma peça que pode jogar.');return;}selectedPieceId=pieceId;render();}
  function playMove(m){if(!canAct())return;if(mode==='friend-guest'){conn?.send({type:'action',action:'move',pieceId:m.pieceId,toR:m.toR,toC:m.toC});selectedPieceId=null;return;}const result=DamaEngine.move(state,currentId(),m.pieceId,m.toR,m.toC);if(!result.ok){toast(result.error);return;}beep(result.won?880:result.captured?720:500,.1);selectedPieceId=result.continue?m.pieceId:null;if(mode==='friend-host')sendState();render();}

  function botMoveScore(m){let score=Math.random()*20;if(m.captureId)score+=1000;const piece=state.pieces.find(p=>p.id===m.pieceId);if(piece&&!piece.king&&((piece.color==='blue'&&m.toR===7)||(piece.color==='red'&&m.toR===0)))score+=500;score+=30-Math.abs(3.5-m.toC)*4;return score;}
  function scheduleBotTurn(){clearBotTimer();if(!isBotTurn()||state.winner)return;busy=true;render();botTimer=setTimeout(()=>{botTimer=null;if(!isBotTurn()||state.winner){busy=false;render();return;}const moves=DamaEngine.legalMoves(state,BOT_ID);if(!moves.length){busy=false;render();return;}const best=[...moves].sort((a,b)=>botMoveScore(b)-botMoveScore(a))[0];const result=DamaEngine.move(state,BOT_ID,best.pieceId,best.toR,best.toC);beep(result.captured?650:430,.09);busy=false;selectedPieceId=null;render();},650);}

  function pushChat(message){chatHistory.push(message);if(chatHistory.length>60)chatHistory=chatHistory.slice(-60);renderChat();}
  function renderChat(){if(!els.chatMessages)return;if(!chatHistory.length){els.chatMessages.innerHTML='<div class="chat-empty">💬<br>Conversem por aqui durante a partida.</div>';return;}const mine=isOnline()?myOnlineId():'';els.chatMessages.innerHTML=chatHistory.map(m=>{const isMine=m.from===mine;let time='';try{time=new Date(m.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}catch{}return `<div class="chat-row ${isMine?'mine':''}"><div class="chat-bubble"><span class="chat-meta">${isMine?'Você':'Amigo'}${time?' • '+time:''}</span>${escapeHtml(m.text)}</div></div>`;}).join('');els.chatMessages.scrollTop=els.chatMessages.scrollHeight;}
  function sendChat(text){const clean=String(text||'').trim().slice(0,280);if(!clean)return;if(!isOnline()||!conn?.open){toast('Seu amigo ainda não está conectado.');return;}const msg={from:myOnlineId(),text:clean,ts:Date.now()};pushChat(msg);try{conn.send({type:'chat',...msg});}catch{toast('Não foi possível enviar a mensagem.');}}
  function updateSocialConnection(){const connected=!!(isOnline()&&conn?.open);els.chatDot?.classList.toggle('connected',connected);if(els.chatInput)els.chatInput.disabled=!connected;if(els.chatSend)els.chatSend.disabled=!connected;}

  async function toggleVoice(){if(!isOnline()){toast('A conversa por voz é do modo com amigo.');return;}if(voiceEnabled){stopVoice(true);toast('Conversa por voz encerrada.');return;}if(!navigator.mediaDevices?.getUserMedia){toast('Este navegador não liberou acesso ao microfone.');return;}try{localAudioStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});voiceEnabled=true;micMuted=false;updateVoiceUI();if(conn?.open){conn.send({type:'voice-ready',ready:true});if(mode==='friend-host')maybeStartVoiceCall();}toast('Microfone ativado.');}catch(err){console.warn('Microphone error',err);voiceEnabled=false;localAudioStream=null;updateVoiceUI();toast('Permita o acesso ao microfone para usar a voz.');}}
  function toggleMute(){if(!voiceEnabled||!localAudioStream)return;micMuted=!micMuted;localAudioStream.getAudioTracks().forEach(t=>t.enabled=!micMuted);updateVoiceUI();}
  function maybeStartVoiceCall(){if(mode!=='friend-host'||!voiceEnabled||!localAudioStream||!remoteVoiceReady||!peer||!conn?.open||currentCall)return;try{const call=peer.call(conn.peer,localAudioStream,{metadata:{room:roomCode}});if(!call)return;currentCall=call;voiceLinked=false;bindMediaCall(call);updateVoiceUI();}catch(err){console.warn('Voice call error',err);scheduleVoiceRetry();}}
  function handleIncomingCall(call){if(mode!=='friend-guest'||!voiceEnabled||!localAudioStream){try{call.close();}catch{}return;}try{if(currentCall&&currentCall!==call)currentCall.close();currentCall=call;call.answer(localAudioStream);bindMediaCall(call);updateVoiceUI();}catch(err){console.warn('Voice answer error',err);}}
  function bindMediaCall(call){call.on('stream',stream=>{voiceLinked=true;if(els.remoteAudio){els.remoteAudio.srcObject=stream;els.remoteAudio.volume=1;const p=els.remoteAudio.play();if(p?.catch)p.catch(()=>{});}updateVoiceUI();});call.on('close',()=>{if(currentCall===call)currentCall=null;voiceLinked=false;if(els.remoteAudio)els.remoteAudio.srcObject=null;updateVoiceUI();if(mode==='friend-host'&&voiceEnabled&&remoteVoiceReady)scheduleVoiceRetry();});call.on('error',err=>{console.warn('Media call error',err);if(currentCall===call)currentCall=null;voiceLinked=false;updateVoiceUI();if(mode==='friend-host'&&voiceEnabled&&remoteVoiceReady)scheduleVoiceRetry();});}
  function scheduleVoiceRetry(){clearTimeout(voiceRetryTimer);voiceRetryTimer=setTimeout(()=>{voiceRetryTimer=null;maybeStartVoiceCall();},1600);}
  function updateVoiceUI(){if(!els.voiceBtn)return;els.voiceBtn.textContent=voiceEnabled?'Encerrar voz':'Ativar voz';els.voiceBtn.classList.toggle('live',voiceEnabled);els.muteBtn.disabled=!voiceEnabled;els.muteBtn.textContent=micMuted?'🎙️ Desmutar':'🔇 Mutar';let text='Voz desativada';if(voiceEnabled&&!conn?.open)text='Microfone ligado • reconectando';else if(voiceEnabled&&!remoteVoiceReady)text='Microfone ligado • aguardando amigo';else if(voiceEnabled&&remoteVoiceReady&&!voiceLinked)text='Conectando áudio...';else if(voiceEnabled&&voiceLinked)text=micMuted?'Conectado • seu microfone está mudo':'Conectado • vocês já podem conversar';els.voiceStatus.textContent=text;}

  async function shareInvite(){if(!inviteUrl)return;try{if(navigator.share)await navigator.share({title:'Dama Friends',text:'Joga Dama comigo!',url:inviteUrl});else{await navigator.clipboard.writeText(inviteUrl);toast('Link copiado!');}}catch{}}
  async function copyInvite(){if(!inviteUrl)return;try{await navigator.clipboard.writeText(inviteUrl);toast('Link copiado!');}catch{toast('Segure o link para copiar.');}}

  els.friendMode.addEventListener('click',()=>startFriendHost(randomRoom()));els.botMode.addEventListener('click',startBotGame);els.localMode.addEventListener('click',startLocalGame);els.back.addEventListener('click',goMenu);els.cancelLobby.addEventListener('click',goMenu);els.newGame.addEventListener('click',()=>{if(mode==='bot')startBotGame();else if(mode==='local')startLocalGame();else if(mode==='friend-host')startOnlineMatchHost();});els.sound.addEventListener('click',()=>{soundOn=!soundOn;els.sound.textContent=soundOn?'🔊':'🔇';});els.share.addEventListener('click',shareInvite);els.copy.addEventListener('click',copyInvite);els.chatForm.addEventListener('submit',e=>{e.preventDefault();const text=els.chatInput.value;sendChat(text);if(String(text).trim())els.chatInput.value='';});els.voiceBtn.addEventListener('click',toggleVoice);els.muteBtn.addEventListener('click',toggleMute);window.addEventListener('beforeunload',()=>{try{localAudioStream?.getTracks().forEach(t=>t.stop());}catch{}});

  renderChat();updateVoiceUI();const params=new URLSearchParams(location.search),join=params.get('room'),host=params.get('host');if(join)startFriendGuest(join.toUpperCase());else if(host)startFriendHost(host.toUpperCase());
})();
