(() => {
  const $ = s => document.querySelector(s);
  const els = {
    home:$('#homeView'), lobby:$('#lobbyView'), game:$('#gameView'),
    loadingTitle:$('#loadingTitle'), loadingText:$('#loadingText'),
    badge:$('#connectionBadge'), roomCode:$('#roomCodeText'), inviteLink:$('#inviteLink'), copyCode:$('#copyCodeBtn'), copyLink:$('#copyLinkBtn'), share:$('#shareBtn'), lobbyPlayers:$('#lobbyPlayers'), playerCount:$('#playerCount'), start:$('#startGameBtn'), lobbyHint:$('#lobbyHint'),
    board:$('#board'), turnTitle:$('#turnTitle'), gameRoomCode:$('#gameRoomCode'), dice:$('#dice'), roll:$('#rollBtn'), hint:$('#actionHint'), score:$('#scoreList'), log:$('#gameLog'), roundBadge:$('#roundBadge'),
    gameInvite:$('#gameInviteBtn'), inviteModal:$('#inviteModal'), closeInviteModal:$('#closeInviteModal'), gameInviteLink:$('#gameInviteLink'), gameShare:$('#gameShareBtn'),
    toast:$('#toast'), sound:$('#soundBtn')
  };

  const DICE_CHARS=['⚀','⚁','⚂','⚃','⚄','⚅'];
  let peer=null, hostConnection=null, connections=new Map();
  let isHost=false, roomCode='', myId='', myName='', state=null, soundOn=true;
  let localFallback=false;
  let reconnectTimer=null, joinTimeout=null, heartbeatTimer=null;
  let reconnectAttempts=0;
  const disconnectTimers=new Map();

  function randomCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
  function playerId(){ return 'p-'+Math.random().toString(36).slice(2,10); }
  function showView(name){ [els.home,els.lobby,els.game].forEach(v=>v.classList.remove('active')); els[name].classList.add('active'); }
  function toast(msg){ els.toast.textContent=msg; els.toast.classList.remove('hidden'); setTimeout(()=>els.toast.classList.add('hidden'),1800); }
  function setBadge(text,online=true){ els.badge.textContent=text; els.badge.classList.toggle('muted',!online); }
  function setLoading(title,text){ if(els.loadingTitle) els.loadingTitle.textContent=title; if(els.loadingText) els.loadingText.textContent=text; }
  function cleanCode(code){ return (code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,''); }
  function inviteUrl(){ const u=new URL(location.href); u.search=''; u.hash=''; u.searchParams.set('room',roomCode); return u.toString(); }
  function shareText(){ return `Vem jogar Ludo comigo! 🎲\nSala: ${roomCode}\n${inviteUrl()}`; }

  function beep(freq=520,duration=.08){
    if(!soundOn) return;
    try{ const ac=new (window.AudioContext||window.webkitAudioContext)(); const o=ac.createOscillator(),g=ac.createGain(); o.frequency.value=freq;o.connect(g);g.connect(ac.destination);g.gain.setValueAtTime(.05,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);o.start();o.stop(ac.currentTime+duration);}catch(e){}
  }

  function clearReconnectTimer(){
    if(reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer=null; }
  }

  function clearJoinTimeout(){
    if(joinTimeout){ clearTimeout(joinTimeout); joinTimeout=null; }
  }

  function startHeartbeat(){
    if(heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer=setInterval(()=>{
      if(isHost){
        connections.forEach(c=>{ try{ if(c.open) c.send({type:'ping',at:Date.now()}); }catch(e){} });
      } else if(hostConnection?.open){
        try{ hostConnection.send({type:'ping',at:Date.now()}); }catch(e){}
      }
    },10000);
  }

  function reconnectPeerSignaling(){
    if(!peer || peer.destroyed || !peer.disconnected) return;
    try{ peer.reconnect(); }catch(e){ console.warn('Falha ao reconectar sinalização',e); }
  }

  function setupPeer(id, onFirstOpen){
    if(!window.Peer){ localFallback=true; setBadge('modo local',false); onFirstOpen?.(); return; }
    try{
      let firstOpen=true;
      // Versão sem backend/Redis. O PeerServer Cloud cuida apenas da sinalização e
      // os servidores TURN abaixo fazem o relay quando duas redes não aceitam
      // conexão P2P direta (ex.: Wi-Fi x 4G/5G, CGNAT e firewalls mais rígidos).
      const peerOptions={
        debug:0,
        config:{
          iceServers:[
            {urls:'stun:stun.relay.metered.ca:80'},
            {urls:'stun:stun.l.google.com:19302'},
            {urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},
            {urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'},
            {urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}
          ],
          iceCandidatePoolSize:10
        }
      };
      peer=id ? new Peer(id,peerOptions) : new Peer(peerOptions);
      peer.on('open',pid=>{
        setBadge('online',true);
        reconnectAttempts=0;
        clearReconnectTimer();
        if(firstOpen){ firstOpen=false; onFirstOpen?.(pid); }
        else if(!isHost && roomCode && !hostConnection?.open){ connectToHost(); }
      });
      peer.on('error',err=>{
        console.warn('PeerJS:',err);
        if(err.type==='unavailable-id'){
          if(isHost){ toast('Essa sala já está em uso. Criando outra sala...'); setBadge('erro',false); }
        } else if(err.type==='peer-unavailable'){
          if(!isHost){ setBadge('procurando sala...',false); setLoading('Procurando a sala...','O convite ainda não respondeu. Tentando novamente.'); }
        } else {
          setBadge('reconectando...',false);
          schedulePeerReconnect();
        }
      });
      peer.on('disconnected',()=>{
        // Perder apenas a sinalização não encerra uma conexão WebRTC já aberta.
        if(!isHost && hostConnection?.open) setBadge('online',true);
        else setBadge('reconectando...',false);
        schedulePeerReconnect();
      });
      peer.on('close',()=>{
        setBadge('desconectado',false);
        if(!isHost) scheduleGuestReconnect();
      });
    }catch(e){
      console.warn(e);
      localFallback=true; setBadge('modo local',false); onFirstOpen?.();
    }
  }

  function schedulePeerReconnect(){
    if(reconnectTimer || !peer || peer.destroyed) return;
    const delay=Math.min(800*Math.pow(1.7,reconnectAttempts++),6000);
    reconnectTimer=setTimeout(()=>{
      reconnectTimer=null;
      reconnectPeerSignaling();
      if(peer?.disconnected && !peer.destroyed) schedulePeerReconnect();
    },delay);
  }

  function createRoom(){
    myName='Jogador 1'; myId=playerId(); roomCode=randomCode(); isHost=true;
    setLoading('Criando sua sala...','Em instantes você poderá compartilhar o convite.');
    setBadge('conectando...',false);
    setupPeer('ludofriends-'+roomCode.toLowerCase(),()=>{
      state={phase:'lobby',roomCode,players:[{id:myId,name:'Jogador 1',host:true,color:'red'}]};
      if(peer){ peer.on('connection',conn=>acceptConnection(conn)); }
      startHeartbeat();
      enterLobby();
    });
  }

  function acceptConnection(conn){
    conn.on('data',msg=>handleHostMessage(conn,msg));
    conn.on('error',err=>console.warn('Conexão convidado:',err));
    conn.on('close',()=>{
      const pid=conn._playerId;
      if(!pid) return;
      if(connections.get(pid)===conn) connections.delete(pid);
      if(state?.phase==='lobby') schedulePlayerRemoval(pid);
    });
  }

  function schedulePlayerRemoval(pid){
    clearTimeout(disconnectTimers.get(pid));
    disconnectTimers.set(pid,setTimeout(()=>{
      disconnectTimers.delete(pid);
      if(connections.get(pid)?.open) return;
      if(state?.phase==='lobby'){
        state.players=state.players.filter(p=>p.id!==pid);
        broadcast();
        renderLobby();
      }
    },12000));
  }

  function handleHostMessage(conn,msg){
    if(!msg || typeof msg!=='object') return;
    if(msg.type==='ping'){
      try{ if(conn.open) conn.send({type:'pong',at:msg.at}); }catch(e){}
      return;
    }
    if(msg.type==='join'){
      const id=msg.player?.id;
      if(!id) return;
      const existing=state?.players?.find(p=>p.id===id);

      // Reconexão: o mesmo jogador pode voltar para a sala/partida sem ser duplicado.
      if(existing){
        clearTimeout(disconnectTimers.get(id)); disconnectTimers.delete(id);
        conn._playerId=id; connections.set(id,conn);
        existing.name=existing.name||'Jogador';
        try{ conn.send({type:'joined',state,reconnected:true}); }catch(e){}
        broadcast();
        if(state.phase==='lobby') renderLobby();
        return;
      }

      if(state.phase!=='lobby') return conn.send({type:'error',message:'Essa partida já começou.'});
      if(state.players.length>=4) return conn.send({type:'error',message:'A sala está cheia.'});
      conn._playerId=id; connections.set(id,conn);
      const usedNames=new Set(state.players.map(p=>p.name));
      let automaticName='Jogador 2';
      for(let n=2;n<=4;n++){ if(!usedNames.has(`Jogador ${n}`)){ automaticName=`Jogador ${n}`; break; } }
      state.players.push({id,name:automaticName,host:false,color:LudoEngine.COLORS[state.players.length]});
      conn.send({type:'joined',state}); broadcast(); renderLobby(); beep(680);
      return;
    }
    if(msg.type==='action' && state.phase==='playing') processAction(msg.playerId,msg.action,msg.payload);
  }

  function joinRoom(code){
    roomCode=cleanCode(code); isHost=false; myName='';
    const idKey='ludo-player-id-'+roomCode;
    myId=sessionStorage.getItem(idKey)||playerId();
    sessionStorage.setItem(idKey,myId);
    sessionStorage.setItem('ludo-room-code',roomCode);
    setLoading('Entrando na partida...','Localizando a sala e conectando você automaticamente.');
    setBadge('conectando...',false);
    setupPeer(undefined,()=>{
      if(localFallback){ setLoading('Não foi possível conectar','Verifique a internet e abra o convite novamente.'); return; }
      startHeartbeat();
      connectToHost(true);
    });
  }

  function connectToHost(initial=false){
    if(isHost || !peer || peer.destroyed) return;
    if(!peer.open){
      reconnectPeerSignaling();
      scheduleGuestReconnect();
      return;
    }
    if(hostConnection?.open) return;

    try{ hostConnection?.close(); }catch(e){}
    const conn=peer.connect('ludofriends-'+roomCode.toLowerCase(),{reliable:true,serialization:'json'});
    let joinedAck=false;
    hostConnection=conn;
    setBadge(initial?'conectando...':'reconectando...',false);
    clearJoinTimeout();
    joinTimeout=setTimeout(()=>{
      if(hostConnection!==conn || joinedAck) return;
      setLoading('Reconectando...','A sala demorou para responder. Estamos tentando novamente automaticamente.');
      try{ conn.close(); }catch(e){}
      scheduleGuestReconnect();
    },12000);

    conn.on('open',()=>{
      if(hostConnection!==conn) return;
      reconnectAttempts=0;
      setBadge('online',true);
      setLoading('Conectado!','Entrando na sala...');
      conn.send({type:'join',player:{id:myId}});
    });
    conn.on('data',msg=>{
      if(hostConnection!==conn || !msg || typeof msg!=='object') return;
      if(msg.type==='ping'){
        try{ conn.send({type:'pong',at:msg.at}); }catch(e){}
        return;
      }
      if(msg.type==='pong') return;
      if(msg.type==='joined' || msg.type==='state'){
        joinedAck=true;
        clearJoinTimeout();
        state=msg.state; roomCode=state.roomCode||roomCode; setBadge('online',true);
        const me=state.players?.find(p=>p.id===myId); if(me) myName=me.name;
        if(state.phase==='lobby') enterLobby(); else enterGame();
      } else if(msg.type==='error'){
        clearJoinTimeout();
        setLoading('Não foi possível entrar',msg.message);
      }
    });
    conn.on('close',()=>{
      if(hostConnection!==conn) return;
      setBadge('reconectando...',false);
      scheduleGuestReconnect();
    });
    conn.on('error',err=>{
      if(hostConnection!==conn) return;
      console.warn('Conexão com host:',err);
      setBadge('reconectando...',false);
      scheduleGuestReconnect();
    });
  }

  function scheduleGuestReconnect(){
    if(isHost || reconnectTimer) return;
    const delay=Math.min(1200*Math.pow(1.55,reconnectAttempts++),9000);
    reconnectTimer=setTimeout(()=>{
      reconnectTimer=null;
      if(hostConnection?.open){ reconnectAttempts=0; return; }
      if(peer?.destroyed){
        setupPeer(undefined,()=>connectToHost(false));
        return;
      }
      if(peer?.disconnected) reconnectPeerSignaling();
      connectToHost(false);
    },delay);
  }

  function broadcast(){
    if(!isHost || !state) return;
    connections.forEach((c,pid)=>{
      try{ if(c.open) c.send({type:'state',state}); }
      catch(e){ console.warn('Falha ao enviar estado para',pid,e); }
    });
  }

  function enterLobby(){
    showView('lobby');
    els.roomCode.textContent=roomCode;
    els.inviteLink.value=inviteUrl(); els.gameInviteLink.value=inviteUrl();
    renderLobby();
  }

  function renderLobby(){
    if(!state) return;
    els.playerCount.textContent=`${state.players.length}/4`;
    els.lobbyPlayers.innerHTML=state.players.map((p,i)=>`
      <div class="player-row"><div class="player-meta"><span class="player-dot" style="background:${cssColor(p.color||LudoEngine.COLORS[i])}"></span><div><div class="player-name">${escapeHtml(p.name)}${p.id===myId?' (você)':''}</div><div class="player-label">${p.host?'Dono da sala':'Convidado'}</div></div></div><span>${p.host?'👑':'✓'}</span></div>`).join('');
    els.start.style.display=isHost?'block':'none';
    els.start.disabled=state.players.length<2;
    els.lobbyHint.textContent=isHost ? (state.players.length<2?'Aguardando pelo menos mais 1 jogador...':'Tudo pronto. Você já pode iniciar!') : 'Aguardando o dono da sala iniciar a partida...';
  }

  function startGame(){
    if(!isHost || state.players.length<2) return;
    state=LudoEngine.newGame(state.players); state.roomCode=roomCode; broadcast(); enterGame(); beep(740,.12);
  }

  function enterGame(){ showView('game'); els.gameRoomCode.textContent=roomCode; buildBoard(); renderGame(); }

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
      const gi=LudoEngine.PATH.findIndex(([rr,cc])=>rr===r&&cc===c); if(LudoEngine.SAFE_GLOBAL.has(gi)) cell.classList.add('safe');
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
    els.roll.disabled=!!state.winner || !mine || state.rolled;
    if(state.winner) els.hint.textContent=`${playerName(state.winner)} levou as 4 peças para a chegada.`;
    else if(mine && !state.rolled) els.hint.textContent='Jogue o dado.';
    else if(mine && state.rolled) els.hint.textContent='Escolha uma peça destacada.';
    else els.hint.textContent='Aguarde sua vez.';

    els.score.innerHTML=state.players.map((p,i)=>{
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
      const [r,c]=LudoEngine.coordForPiece(p); const el=document.createElement('button'); el.className=`piece ${p.color}`; el.type='button';
      const spread=group.length>1 ? 1.1 : 0; const angle=(Math.PI*2*idx)/group.length;
      const x=((c+.5)/15)*100 + Math.cos(angle)*spread; const y=((r+.5)/15)*100 + Math.sin(angle)*spread;
      el.style.left=x+'%'; el.style.top=y+'%'; el.title=`Peça ${p.piece+1}`;
      if(p.playerId===myId && movable.has(p.id) && !state.winner){ el.classList.add('movable'); el.addEventListener('click',()=>sendAction('move',{pieceId:p.id})); }
      els.board.appendChild(el);
    }));
  }

  function processAction(pid,action,payload){
    if(!isHost || !state) return;
    if(action==='roll'){
      const r=LudoEngine.roll(state,pid); if(r.ok){ broadcast(); renderGame(); animateDice(r.dice); }
    } else if(action==='move'){
      const r=LudoEngine.move(state,pid,payload.pieceId); if(r.ok){ broadcast(); renderGame(); beep(r.won?880:r.captured?710:500,.1); }
    }
  }

  function sendAction(action,payload={}){
    if(isHost) return processAction(myId,action,payload);
    if(hostConnection?.open){
      try{ hostConnection.send({type:'action',playerId:myId,action,payload}); }
      catch(e){ scheduleGuestReconnect(); }
    } else {
      toast('Reconectando à sala...');
      scheduleGuestReconnect();
    }
  }

  function animateDice(value){ els.dice.classList.remove('rolling'); void els.dice.offsetWidth; els.dice.classList.add('rolling'); setTimeout(()=>{ if(value) els.dice.textContent=DICE_CHARS[value-1]; },220); }
  function playerName(id){ return state.players.find(p=>p.id===id)?.name||'Jogador'; }
  function cssColor(c){ return ({red:'#ff4d5e',green:'#21c16b',yellow:'#f5c941',blue:'#4285ff'})[c]||'#999'; }
  function escapeHtml(s){ return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m])); }

  async function copy(text){ try{ await navigator.clipboard.writeText(text); toast('Copiado!'); }catch{ const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast('Copiado!'); } }
  async function share(){ if(navigator.share){ try{ await navigator.share({title:'Ludo Friends',text:'Vem jogar Ludo comigo! 🎲',url:inviteUrl()}); }catch{} } else copy(shareText()); }

  els.start.onclick=startGame; els.roll.onclick=()=>sendAction('roll');
  els.copyCode.onclick=()=>copy(roomCode); els.copyLink.onclick=()=>copy(inviteUrl()); els.share.onclick=share;
  els.gameInvite.onclick=()=>{ els.gameInviteLink.value=inviteUrl(); els.inviteModal.classList.remove('hidden'); };
  els.closeInviteModal.onclick=()=>els.inviteModal.classList.add('hidden'); els.gameShare.onclick=share;
  els.sound.onclick=()=>{ soundOn=!soundOn; els.sound.textContent=soundOn?'🔊':'🔇'; };

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible') return;
    if(peer?.disconnected && !peer.destroyed) reconnectPeerSignaling();
    if(!isHost && roomCode && !hostConnection?.open) scheduleGuestReconnect();
  });

  window.addEventListener('online',()=>{
    setBadge('reconectando...',false);
    if(peer?.disconnected && !peer.destroyed) reconnectPeerSignaling();
    if(!isHost && roomCode && !hostConnection?.open) scheduleGuestReconnect();
  });

  // Fluxo direto: sem Nick e sem formulário.
  // URL normal cria uma nova sala. Link ?room=ABC123 entra automaticamente na sala existente.
  const roomParam=cleanCode(new URLSearchParams(location.search).get('room'));
  if(roomParam) joinRoom(roomParam); else createRoom();
})();
