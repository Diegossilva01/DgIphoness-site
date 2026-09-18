(() => {
  const $ = s => document.querySelector(s);
  const els = {
    home:$('#homeView'), lobby:$('#lobbyView'), game:$('#gameView'),
    create:$('#createRoomBtn'), confirmCreate:$('#confirmCreateBtn'), nameModal:$('#nameModal'), hostName:$('#hostName'),
    showJoin:$('#showJoinBtn'), joinPanel:$('#joinPanel'), closeJoin:$('#closeJoinBtn'), joinName:$('#joinName'), joinCode:$('#joinCode'), join:$('#joinRoomBtn'), joinError:$('#joinError'),
    badge:$('#connectionBadge'), roomCode:$('#roomCodeText'), inviteLink:$('#inviteLink'), copyCode:$('#copyCodeBtn'), copyLink:$('#copyLinkBtn'), share:$('#shareBtn'), lobbyPlayers:$('#lobbyPlayers'), playerCount:$('#playerCount'), start:$('#startGameBtn'), lobbyHint:$('#lobbyHint'),
    board:$('#board'), turnTitle:$('#turnTitle'), gameRoomCode:$('#gameRoomCode'), dice:$('#dice'), roll:$('#rollBtn'), hint:$('#actionHint'), score:$('#scoreList'), log:$('#gameLog'), roundBadge:$('#roundBadge'),
    gameInvite:$('#gameInviteBtn'), inviteModal:$('#inviteModal'), closeInviteModal:$('#closeInviteModal'), gameInviteLink:$('#gameInviteLink'), gameShare:$('#gameShareBtn'),
    toast:$('#toast'), sound:$('#soundBtn')
  };

  const DICE_CHARS=['⚀','⚁','⚂','⚃','⚄','⚅'];
  let peer=null, hostConnection=null, connections=new Map();
  let isHost=false, roomCode='', myId='', myName='', state=null, soundOn=true;
  let localFallback=false;

  function randomCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
  function playerId(){ return 'p-'+Math.random().toString(36).slice(2,10); }
  function showView(name){ [els.home,els.lobby,els.game].forEach(v=>v.classList.remove('active')); els[name].classList.add('active'); }
  function toast(msg){ els.toast.textContent=msg; els.toast.classList.remove('hidden'); setTimeout(()=>els.toast.classList.add('hidden'),1800); }
  function setBadge(text,online=true){ els.badge.textContent=text; els.badge.classList.toggle('muted',!online); }
  function cleanCode(code){ return (code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,''); }
  function inviteUrl(){ const u=new URL(location.href); u.search=''; u.hash=''; u.searchParams.set('room',roomCode); return u.toString(); }
  function shareText(){ return `Vem jogar Ludo comigo! 🎲\nSala: ${roomCode}\n${inviteUrl()}`; }

  function beep(freq=520,duration=.08){
    if(!soundOn) return;
    try{ const ac=new (window.AudioContext||window.webkitAudioContext)(); const o=ac.createOscillator(),g=ac.createGain(); o.frequency.value=freq;o.connect(g);g.connect(ac.destination);g.gain.setValueAtTime(.05,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);o.start();o.stop(ac.currentTime+duration);}catch(e){}
  }

  function setupPeer(id, onOpen){
    if(!window.Peer){ localFallback=true; setBadge('modo local',false); onOpen?.(); return; }
    try{
      peer=new Peer(id,{debug:0});
      peer.on('open',pid=>{ setBadge('online',true); onOpen?.(pid); });
      peer.on('error',err=>{ console.warn(err); if(err.type==='unavailable-id') toast('Essa sala já está em uso. Tente novamente.'); else toast('Falha de conexão. Verifique a internet.'); setBadge('erro',false); });
      peer.on('disconnected',()=>setBadge('reconectando...',false));
    }catch(e){ localFallback=true; setBadge('modo local',false); onOpen?.(); }
  }

  function createRoom(name){
    myName=name||'Jogador'; myId=playerId(); roomCode=randomCode(); isHost=true;
    setBadge('conectando...',false);
    setupPeer('ludofriends-'+roomCode.toLowerCase(),()=>{
      state={phase:'lobby',roomCode,players:[{id:myId,name:myName,host:true,color:'red'}]};
      if(peer){ peer.on('connection',conn=>acceptConnection(conn)); }
      enterLobby();
    });
  }

  function acceptConnection(conn){
    conn.on('open',()=>{});
    conn.on('data',msg=>handleHostMessage(conn,msg));
    conn.on('close',()=>{
      const pid=conn._playerId;
      if(pid && state?.phase==='lobby'){
        state.players=state.players.filter(p=>p.id!==pid); connections.delete(pid); broadcast(); renderLobby();
      }
    });
  }

  function handleHostMessage(conn,msg){
    if(!msg || typeof msg!=='object') return;
    if(msg.type==='join'){
      if(state.phase!=='lobby') return conn.send({type:'error',message:'Essa partida já começou.'});
      if(state.players.length>=4) return conn.send({type:'error',message:'A sala está cheia.'});
      const id=msg.player.id; conn._playerId=id; connections.set(id,conn);
      state.players.push({id,name:(msg.player.name||'Jogador').slice(0,18),host:false,color:LudoEngine.COLORS[state.players.length]});
      conn.send({type:'joined',state}); broadcast(); renderLobby(); beep(680);
    }
    if(msg.type==='action' && state.phase==='playing') processAction(msg.playerId,msg.action,msg.payload);
  }

  function joinRoom(name,code){
    myName=name||'Jogador'; myId=playerId(); roomCode=cleanCode(code); isHost=false;
    els.joinError.textContent=''; setBadge('conectando...',false);
    setupPeer(undefined,()=>{
      if(localFallback){ els.joinError.textContent='O modo online não carregou. Abra o site com internet.'; return; }
      hostConnection=peer.connect('ludofriends-'+roomCode.toLowerCase(),{reliable:true});
      let timeout=setTimeout(()=>{ els.joinError.textContent='Não encontrei essa sala. Confira o código.'; },7000);
      hostConnection.on('open',()=>{ hostConnection.send({type:'join',player:{id:myId,name:myName}}); });
      hostConnection.on('data',msg=>{
        if(msg.type==='joined' || msg.type==='state'){
          clearTimeout(timeout); state=msg.state; roomCode=state.roomCode||roomCode; setBadge('online',true);
          if(state.phase==='lobby') enterLobby(); else enterGame();
        } else if(msg.type==='error'){ clearTimeout(timeout); els.joinError.textContent=msg.message; }
      });
      hostConnection.on('close',()=>{ setBadge('desconectado',false); toast('Conexão com a sala encerrada.'); });
      hostConnection.on('error',()=>{ clearTimeout(timeout); els.joinError.textContent='Não foi possível entrar nessa sala.'; });
    });
  }

  function broadcast(){
    if(!isHost || !state) return;
    connections.forEach(c=>{ if(c.open) c.send({type:'state',state}); });
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
    if(isHost) processAction(myId,action,payload);
    else if(hostConnection?.open) hostConnection.send({type:'action',playerId:myId,action,payload});
  }

  function animateDice(value){ els.dice.classList.remove('rolling'); void els.dice.offsetWidth; els.dice.classList.add('rolling'); setTimeout(()=>{ if(value) els.dice.textContent=DICE_CHARS[value-1]; },220); }
  function playerName(id){ return state.players.find(p=>p.id===id)?.name||'Jogador'; }
  function cssColor(c){ return ({red:'#ff4d5e',green:'#21c16b',yellow:'#f5c941',blue:'#4285ff'})[c]||'#999'; }
  function escapeHtml(s){ return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m])); }

  async function copy(text){ try{ await navigator.clipboard.writeText(text); toast('Copiado!'); }catch{ const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast('Copiado!'); } }
  async function share(){ if(navigator.share){ try{ await navigator.share({title:'Ludo Friends',text:'Vem jogar Ludo comigo! 🎲',url:inviteUrl()}); }catch{} } else copy(shareText()); }

  els.create.onclick=()=>{ els.nameModal.classList.remove('hidden'); setTimeout(()=>els.hostName.focus(),80); };
  els.confirmCreate.onclick=()=>{ const n=els.hostName.value.trim()||'Jogador'; els.nameModal.classList.add('hidden'); createRoom(n); };
  els.hostName.addEventListener('keydown',e=>{ if(e.key==='Enter') els.confirmCreate.click(); });
  els.showJoin.onclick=()=>{ els.joinPanel.classList.remove('hidden'); setTimeout(()=>els.joinName.focus(),80); };
  els.closeJoin.onclick=()=>els.joinPanel.classList.add('hidden');
  els.join.onclick=()=>{ const name=els.joinName.value.trim(); const code=cleanCode(els.joinCode.value); if(!name) return els.joinError.textContent='Digite seu nome.'; if(code.length<4) return els.joinError.textContent='Digite o código da sala.'; joinRoom(name,code); };
  els.joinCode.addEventListener('input',()=>els.joinCode.value=cleanCode(els.joinCode.value));
  els.start.onclick=startGame; els.roll.onclick=()=>sendAction('roll');
  els.copyCode.onclick=()=>copy(roomCode); els.copyLink.onclick=()=>copy(inviteUrl()); els.share.onclick=share;
  els.gameInvite.onclick=()=>{ els.gameInviteLink.value=inviteUrl(); els.inviteModal.classList.remove('hidden'); };
  els.closeInviteModal.onclick=()=>els.inviteModal.classList.add('hidden'); els.gameShare.onclick=share;
  els.sound.onclick=()=>{ soundOn=!soundOn; els.sound.textContent=soundOn?'🔊':'🔇'; };

  // Link de convite: ?room=ABC123
  const roomParam=cleanCode(new URLSearchParams(location.search).get('room'));
  if(roomParam){ els.showJoin.click(); els.joinCode.value=roomParam; }
})();
