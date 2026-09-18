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
  let socket=null, state=null, roomCode='', myId='', isHost=false, soundOn=true;
  let lastPhase=null;

  function randomId(){ return 'p-'+cryptoRandom(16); }
  function cryptoRandom(len){
    const chars='abcdefghijklmnopqrstuvwxyz0123456789';
    const a=new Uint8Array(len); crypto.getRandomValues(a);
    return Array.from(a,v=>chars[v%chars.length]).join('');
  }
  function showView(name){ [els.home,els.lobby,els.game].forEach(v=>v.classList.remove('active')); els[name].classList.add('active'); }
  function toast(msg){ els.toast.textContent=msg; els.toast.classList.remove('hidden'); setTimeout(()=>els.toast.classList.add('hidden'),1800); }
  function setBadge(text,online=true){ els.badge.textContent=text; els.badge.classList.toggle('muted',!online); }
  function setLoading(title,text){ els.loadingTitle.textContent=title; els.loadingText.textContent=text; }
  function cleanCode(code){ return (code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,''); }
  function inviteUrl(){ const u=new URL(location.href); u.search=''; u.hash=''; u.searchParams.set('room',roomCode); return u.toString(); }
  function shareText(){ return `Vem jogar Ludo comigo! 🎲\nSala: ${roomCode}\n${inviteUrl()}`; }

  function beep(freq=520,duration=.08){
    if(!soundOn) return;
    try{ const ac=new (window.AudioContext||window.webkitAudioContext)(); const o=ac.createOscillator(),g=ac.createGain(); o.frequency.value=freq;o.connect(g);g.connect(ac.destination);g.gain.setValueAtTime(.05,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);o.start();o.stop(ac.currentTime+duration);}catch(e){}
  }

  function getClientId(code){
    const key='ludo-client-'+(code||'host');
    let id=sessionStorage.getItem(key);
    if(!id){ id=randomId(); sessionStorage.setItem(key,id); }
    return id;
  }

  function connect(){
    if(!window.io){
      setBadge('erro',false);
      setLoading('Falha ao carregar conexão','Atualize a página e tente novamente.');
      return;
    }
    socket=io({
      path:'/api/socket-io/socket.io',
      transports:['websocket'],
      reconnection:true,
      reconnectionAttempts:Infinity,
      reconnectionDelay:600,
      reconnectionDelayMax:4000,
      timeout:12000
    });

    socket.on('connect',()=>{
      setBadge('online',true);
      const param=cleanCode(new URLSearchParams(location.search).get('room'));
      if(param) joinRoom(param); else createRoom();
    });

    socket.io.on('reconnect_attempt',()=>setBadge('reconectando...',false));
    socket.on('disconnect',()=>{
      setBadge('reconectando...',false);
      if(state) toast('Conexão oscilou. Reconectando...');
    });

    socket.on('room-state',payload=>{
      if(!payload?.state) return;
      if(state?.serverRevision && payload.state.serverRevision && payload.state.serverRevision < state.serverRevision) return;
      state=payload.state;
      roomCode=state.roomCode||roomCode;
      isHost=!!state.players?.find(p=>p.id===myId)?.host;
      setBadge('online',true);
      if(state.phase==='lobby') enterLobby(); else enterGame();
    });

    socket.on('room-error',msg=>{
      setBadge('erro',false);
      setLoading('Não foi possível entrar',msg||'Sala indisponível.');
      toast(msg||'Sala indisponível.');
    });

    socket.on('action-error',msg=>toast(msg||'Jogada inválida.'));
  }

  function createRoom(){
    if(!socket?.connected) return;
    myId=getClientId('host');
    setLoading('Criando sua sala...','Conectando ao servidor do jogo.');
    socket.emit('create-room',{clientId:myId},res=>{
      if(!res?.ok){
        setLoading('Não foi possível criar a sala',res?.error||'Tente novamente.');
        return;
      }
      roomCode=res.roomCode; state=res.state; isHost=true;
      history.replaceState(null,'',location.pathname);
      enterLobby();
    });
  }

  function joinRoom(code){
    if(!socket?.connected) return;
    roomCode=cleanCode(code);
    myId=getClientId(roomCode);
    setLoading('Entrando na partida...','Conectando você automaticamente.');
    socket.emit('join-room',{roomCode,clientId:myId},res=>{
      if(!res?.ok){
        setLoading('Não foi possível entrar',res?.error||'Sala indisponível.');
        setBadge('erro',false);
        return;
      }
      state=res.state;
      isHost=!!state.players?.find(p=>p.id===myId)?.host;
      if(state.phase==='lobby') enterLobby(); else enterGame();
    });
  }

  function enterLobby(){
    if(!state) return;
    showView('lobby'); lastPhase='lobby';
    els.roomCode.textContent=roomCode;
    els.inviteLink.value=inviteUrl(); els.gameInviteLink.value=inviteUrl();
    renderLobby();
  }

  function renderLobby(){
    if(!state) return;
    els.playerCount.textContent=`${state.players.length}/4`;
    els.lobbyPlayers.innerHTML=state.players.map((p,i)=>`
      <div class="player-row"><div class="player-meta"><span class="player-dot" style="background:${cssColor(p.color||LudoEngine.COLORS[i])}"></span><div><div class="player-name">${escapeHtml(p.name)}${p.id===myId?' (você)':''}</div><div class="player-label">${p.host?'Dono da sala':'Convidado'}${p.connected===false?' · reconectando':''}</div></div></div><span>${p.host?'👑':(p.connected===false?'…':'✓')}</span></div>`).join('');
    els.start.style.display=isHost?'block':'none';
    els.start.disabled=state.players.length<2;
    els.lobbyHint.textContent=isHost ? (state.players.length<2?'Aguardando pelo menos mais 1 jogador...':'Tudo pronto. Você já pode iniciar!') : 'Aguardando o dono da sala iniciar a partida...';
  }

  function startGame(){
    if(!isHost || !socket?.connected) return;
    socket.emit('start-game',{roomCode,clientId:myId},res=>{
      if(!res?.ok) toast(res?.error||'Não foi possível iniciar.');
      else beep(740,.12);
    });
  }

  function enterGame(){
    if(!state) return;
    showView('game');
    els.gameRoomCode.textContent=roomCode;
    if(lastPhase!=='playing') buildBoard();
    lastPhase='playing';
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
    els.roll.disabled=!!state.winner || !mine || state.rolled || !socket?.connected;
    if(state.winner) els.hint.textContent=`${playerName(state.winner)} levou as 4 peças para a chegada.`;
    else if(!socket?.connected) els.hint.textContent='Reconectando ao servidor...';
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
      const [r,c]=LudoEngine.coordForPiece(p); const el=document.createElement('button'); el.className=`piece ${p.color}`; el.type='button';
      const spread=group.length>1 ? 1.1 : 0; const angle=(Math.PI*2*idx)/group.length;
      const x=((c+.5)/15)*100 + Math.cos(angle)*spread; const y=((r+.5)/15)*100 + Math.sin(angle)*spread;
      el.style.left=x+'%'; el.style.top=y+'%'; el.title=`Peça ${p.piece+1}`;
      if(p.playerId===myId && movable.has(p.id) && !state.winner && socket?.connected){
        el.classList.add('movable'); el.addEventListener('click',()=>sendAction('move',{pieceId:p.id}));
      }
      els.board.appendChild(el);
    }));
  }

  function sendAction(action,payload={}){
    if(!socket?.connected){ toast('Reconectando ao servidor...'); return; }
    socket.emit('game-action',{roomCode,clientId:myId,action,payload},res=>{
      if(!res?.ok) toast(res?.error||'Jogada inválida.');
      else if(action==='move') beep(res.won?880:res.captured?710:500,.1);
      else if(action==='roll') animateDice(res.dice);
    });
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

  connect();
})();
