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
  let state=null, roomCode='', myId='', isHost=false, soundOn=true, lastPhase=null;
  let polling=false, stopped=false, failures=0;

  function cryptoRandom(len){ const chars='abcdefghijklmnopqrstuvwxyz0123456789'; const a=new Uint8Array(len); crypto.getRandomValues(a); return Array.from(a,v=>chars[v%chars.length]).join(''); }
  function randomId(){ return 'p-'+cryptoRandom(18); }
  function showView(name){ [els.home,els.lobby,els.game].forEach(v=>v.classList.remove('active')); els[name].classList.add('active'); }
  function toast(msg){ els.toast.textContent=msg; els.toast.classList.remove('hidden'); setTimeout(()=>els.toast.classList.add('hidden'),2200); }
  function setBadge(text,online=true){ els.badge.textContent=text; els.badge.classList.toggle('muted',!online); }
  function setLoading(title,text){ els.loadingTitle.textContent=title; els.loadingText.textContent=text; }
  function cleanCode(code){ return (code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8); }
  function inviteUrl(){ const u=new URL(location.href); u.search=''; u.hash=''; u.searchParams.set('room',roomCode); return u.toString(); }
  function shareText(){ return `Vem jogar Ludo comigo! 🎲\nSala: ${roomCode}\n${inviteUrl()}`; }

  function getClientId(code){
    const key='ludo-v4-client-'+(code||'host');
    let id=sessionStorage.getItem(key);
    if(!id){ id=randomId(); sessionStorage.setItem(key,id); }
    return id;
  }

  async function fetchJson(url,options={},timeout=10000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const res=await fetch(url,{...options,signal:controller.signal,cache:'no-store',headers:{'Content-Type':'application/json',...(options.headers||{})}});
      let data={}; try{ data=await res.json(); }catch{}
      if(!res.ok) throw Object.assign(new Error(data.error||data.message||`Erro ${res.status}`),{status:res.status,data});
      return data;
    } finally { clearTimeout(timer); }
  }

  async function api(action,payload={}){
    return fetchJson('/api/room',{method:'POST',body:JSON.stringify({action,clientId:myId,roomCode,...payload})});
  }

  async function checkServer(){
    setBadge('verificando...',false);
    try{
      const health=await fetchJson('/api/health',{},9000);
      if(!health.ok) throw new Error(health.message||'Servidor indisponível.');
      setBadge('online',true); return true;
    }catch(err){
      setBadge('erro',false);
      const code=err?.data?.error;
      if(code==='REDIS_NOT_CONFIGURED'){
        setLoading('Falta conectar o banco Redis','Na Vercel, conecte o Upstash Redis ao projeto e faça um novo deploy.');
      }else{
        setLoading('Servidor indisponível',err?.message||'Não foi possível acessar a API do jogo.');
      }
      return false;
    }
  }

  function applyState(next){
    if(!next) return;
    if(state?.serverRevision && next.serverRevision && next.serverRevision < state.serverRevision) return;
    state=next; roomCode=state.roomCode||roomCode;
    isHost=!!state.players?.find(p=>p.id===myId)?.host;
    failures=0; setBadge('online',true);
    if(state.phase==='lobby') enterLobby(); else enterGame();
  }

  async function createRoom(){
    myId=getClientId('host');
    setLoading('Criando sua sala...','Só mais um instante.');
    const res=await api('create');
    roomCode=res.roomCode; history.replaceState(null,'',location.pathname); applyState(res.state);
  }

  async function joinRoom(code){
    roomCode=cleanCode(code); myId=getClientId(roomCode);
    setLoading('Entrando na partida...','Abrindo a sala automaticamente.');
    const res=await api('join'); applyState(res.state);
  }

  async function boot(){
    const ok=await checkServer(); if(!ok) return;
    try{
      const param=cleanCode(new URLSearchParams(location.search).get('room'));
      if(param) await joinRoom(param); else await createRoom();
      schedulePoll(500);
    }catch(err){
      setBadge('erro',false);
      setLoading('Não foi possível entrar',err?.message||'Atualize a página e tente novamente.');
    }
  }

  function schedulePoll(delay){ if(stopped) return; clearTimeout(schedulePoll.t); schedulePoll.t=setTimeout(poll,delay); }
  async function poll(){
    if(polling || !roomCode || !myId || stopped){ schedulePoll(1200); return; }
    polling=true;
    try{
      const q=new URLSearchParams({roomCode,clientId:myId});
      const res=await fetchJson('/api/room?'+q.toString(),{},8500);
      applyState(res.state);
      const delay=document.hidden?3000:(state?.phase==='playing'?900:1200);
      schedulePoll(delay);
    }catch(err){
      failures++;
      setBadge('reconectando...',false);
      if(state && failures===1) toast('Conexão oscilou. Tentando novamente...');
      if(err?.status===404 || err?.status===403){
        stopped=true; showView('home'); setLoading('Sala encerrada',err.message||'Essa sala não está mais disponível.'); setBadge('offline',false);
      }else schedulePoll(Math.min(1000*failures,5000));
    }finally{ polling=false; }
  }

  function enterLobby(){
    if(!state) return; showView('lobby'); lastPhase='lobby';
    els.roomCode.textContent=roomCode; els.inviteLink.value=inviteUrl(); els.gameInviteLink.value=inviteUrl(); renderLobby();
  }

  function renderLobby(){
    els.playerCount.textContent=`${state.players.length}/4`;
    els.lobbyPlayers.innerHTML=state.players.map((p,i)=>`<div class="player-row"><div class="player-meta"><span class="player-dot" style="background:${cssColor(p.color||LudoEngine.COLORS[i])}"></span><div><div class="player-name">${escapeHtml(p.name)}${p.id===myId?' (você)':''}</div><div class="player-label">${p.host?'Dono da sala':'Convidado'}${p.connected===false?' · offline':''}</div></div></div><span>${p.host?'👑':(p.connected===false?'○':'✓')}</span></div>`).join('');
    const online=state.players.filter(p=>p.connected!==false).length;
    els.start.style.display=isHost?'block':'none'; els.start.disabled=state.players.length<2 || online<2;
    els.lobbyHint.textContent=isHost ? (state.players.length<2?'Aguardando pelo menos mais 1 jogador...':online<2?'O outro jogador está reconectando...':'Tudo pronto. Você já pode iniciar!') : 'Aguardando o dono da sala iniciar a partida...';
  }

  async function startGame(){
    if(!isHost) return;
    try{ const res=await api('start'); applyState(res.state); beep(740,.12); }
    catch(err){ toast(err.message||'Não foi possível iniciar.'); }
  }

  function enterGame(){
    if(!state) return; showView('game'); els.gameRoomCode.textContent=roomCode;
    if(lastPhase!=='playing') buildBoard(); lastPhase='playing'; renderGame();
  }

  function buildBoard(){
    els.board.innerHTML='';
    for(let r=0;r<15;r++) for(let c=0;c<15;c++){
      const cell=document.createElement('div'); cell.className='cell'; cell.dataset.r=r; cell.dataset.c=c;
      if(LudoEngine.PATH.some(([rr,cc])=>rr===r&&cc===c)) cell.classList.add('track');
      if(r<=5&&c<=5) cell.classList.add('home-red'); if(r<=5&&c>=9) cell.classList.add('home-green'); if(r>=9&&c>=9) cell.classList.add('home-yellow'); if(r>=9&&c<=5) cell.classList.add('home-blue');
      for(const color of LudoEngine.COLORS) if(LudoEngine.LANES[color].some(([rr,cc])=>rr===r&&cc===c)) cell.classList.add('lane-'+color);
      for(const [color,offset] of Object.entries(LudoEngine.START_OFFSET)){ const [rr,cc]=LudoEngine.PATH[offset]; if(rr===r&&cc===c) cell.classList.add('start-'+color,'safe'); }
      const gi=LudoEngine.PATH.findIndex(([rr,cc])=>rr===r&&cc===c); if(LudoEngine.SAFE_GLOBAL.has(gi)) cell.classList.add('safe');
      els.board.appendChild(cell);
    }
    const center=document.createElement('div'); center.className='center-home'; els.board.appendChild(center);
  }

  function renderGame(){
    if(!state || state.phase==='lobby') return;
    const current=LudoEngine.currentPlayer(state), mine=current?.id===myId;
    els.turnTitle.textContent=state.winner?`${playerName(state.winner)} venceu! 🏆`:(mine?'Sua vez!':`Vez de ${current?.name||''}`);
    els.roundBadge.textContent=state.winner?'Finalizada':'Em jogo'; els.dice.textContent=state.dice?DICE_CHARS[state.dice-1]:'⚄';
    els.roll.disabled=!!state.winner || !mine || state.rolled || failures>2;
    if(state.winner) els.hint.textContent=`${playerName(state.winner)} levou as 4 peças para a chegada.`;
    else if(failures>0) els.hint.textContent='Sincronizando...'; else if(mine&&!state.rolled) els.hint.textContent='Jogue o dado.'; else if(mine&&state.rolled) els.hint.textContent='Escolha uma peça destacada.'; else els.hint.textContent='Aguarde sua vez.';
    els.score.innerHTML=state.players.map(p=>{ const home=LudoEngine.piecesForPlayer(state,p.id).filter(x=>x.progress===58).length; return `<div class="score-row ${current?.id===p.id&&!state.winner?'active':''}"><div class="score-info"><span class="player-dot" style="background:${cssColor(p.color)}"></span><strong>${escapeHtml(p.name)}${p.id===myId?' (você)':''}</strong></div><span class="score-home">${home}/4 🏠</span></div>`; }).join('');
    els.log.innerHTML=(state.log||[]).slice(0,12).map(x=>`<div class="log-line">${escapeHtml(x)}</div>`).join(''); renderPieces();
  }

  function renderPieces(){
    els.board.querySelectorAll('.piece').forEach(x=>x.remove()); if(!state?.pieces) return;
    const movable=new Set((LudoEngine.movablePieces(state)||[]).map(p=>p.id)), groups={};
    state.pieces.forEach(p=>{ const [r,c]=LudoEngine.coordForPiece(p); const k=`${r},${c}`; (groups[k] ||= []).push(p); });
    Object.values(groups).forEach(group=>group.forEach((p,idx)=>{
      const [r,c]=LudoEngine.coordForPiece(p), el=document.createElement('button'); el.className=`piece ${p.color}`; el.type='button';
      const spread=group.length>1?1.1:0, angle=(Math.PI*2*idx)/group.length; el.style.left=(((c+.5)/15)*100+Math.cos(angle)*spread)+'%'; el.style.top=(((r+.5)/15)*100+Math.sin(angle)*spread)+'%'; el.title=`Peça ${p.piece+1}`;
      if(p.playerId===myId && movable.has(p.id) && !state.winner){ el.classList.add('movable'); el.addEventListener('click',()=>sendAction('move',{pieceId:p.id})); }
      els.board.appendChild(el);
    }));
  }

  async function sendAction(action,payload={}){
    try{
      const res=await api(action,payload); applyState(res.state);
      const result=res.result||{};
      if(action==='move') beep(result.won?880:result.captured?710:500,.1); else if(action==='roll') animateDice(result.dice);
      schedulePoll(250);
    }catch(err){ toast(err.message||'Jogada inválida.'); schedulePoll(500); }
  }

  function animateDice(value){ els.dice.classList.remove('rolling'); void els.dice.offsetWidth; els.dice.classList.add('rolling'); setTimeout(()=>{ if(value) els.dice.textContent=DICE_CHARS[value-1]; },220); }
  function playerName(id){ return state.players.find(p=>p.id===id)?.name||'Jogador'; }
  function cssColor(c){ return ({red:'#ff4d5e',green:'#21c16b',yellow:'#f5c941',blue:'#4285ff'})[c]||'#999'; }
  function escapeHtml(s){ return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m])); }
  function beep(freq=520,duration=.08){ if(!soundOn)return; try{const ac=new(window.AudioContext||window.webkitAudioContext)(),o=ac.createOscillator(),g=ac.createGain();o.frequency.value=freq;o.connect(g);g.connect(ac.destination);g.gain.setValueAtTime(.05,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);o.start();o.stop(ac.currentTime+duration)}catch{} }
  async function copy(text){ try{await navigator.clipboard.writeText(text);toast('Copiado!')}catch{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast('Copiado!')} }
  async function share(){ if(navigator.share){ try{await navigator.share({title:'Ludo Friends',text:'Vem jogar Ludo comigo! 🎲',url:inviteUrl()})}catch{} } else copy(shareText()); }

  els.start.onclick=startGame; els.roll.onclick=()=>sendAction('roll'); els.copyCode.onclick=()=>copy(roomCode); els.copyLink.onclick=()=>copy(inviteUrl()); els.share.onclick=share;
  els.gameInvite.onclick=()=>{els.gameInviteLink.value=inviteUrl();els.inviteModal.classList.remove('hidden')}; els.closeInviteModal.onclick=()=>els.inviteModal.classList.add('hidden'); els.gameShare.onclick=share;
  els.sound.onclick=()=>{soundOn=!soundOn;els.sound.textContent=soundOn?'🔊':'🔇'};
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) schedulePoll(100); });
  window.addEventListener('online',()=>{setBadge('reconectando...',false);schedulePoll(100)}); window.addEventListener('offline',()=>setBadge('sem internet',false));

  boot();
})();
