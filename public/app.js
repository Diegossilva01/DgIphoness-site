const socket = io();

const SHIPS = [
  { id: 'carrier', name: 'Porta-aviões', length: 5 },
  { id: 'battleship', name: 'Encouraçado', length: 4 },
  { id: 'cruiser', name: 'Cruzador', length: 3 },
  { id: 'submarine', name: 'Submarino', length: 3 },
  { id: 'destroyer', name: 'Destroyer', length: 2 }
];
const BOARD_SIZE = 10;

const $ = id => document.getElementById(id);
const els = {
  lobbyScreen: $('lobbyScreen'), gameScreen: $('gameScreen'), topActions: $('topActions'),
  playerName: $('playerName'), createBtn: $('createBtn'), joinToggleBtn: $('joinToggleBtn'),
  joinFields: $('joinFields'), roomInput: $('roomInput'), joinBtn: $('joinBtn'), lobbyError: $('lobbyError'),
  roomCode: $('roomCode'), copyLinkBtn: $('copyLinkBtn'), battleStatus: $('battleStatus'),
  statusIcon: $('statusIcon'), statusKicker: $('statusKicker'), statusTitle: $('statusTitle'), statusText: $('statusText'),
  meName: $('meName'), opponentName: $('opponentName'), meReady: $('meReady'), opponentReady: $('opponentReady'),
  meCard: $('meCard'), opponentCard: $('opponentCard'), placementPanel: $('placementPanel'), placementBoard: $('placementBoard'),
  fleetList: $('fleetList'), placementCounter: $('placementCounter'), rotateBtn: $('rotateBtn'), randomBtn: $('randomBtn'),
  resetBtn: $('resetBtn'), readyBtn: $('readyBtn'), battlePanel: $('battlePanel'), myBoard: $('myBoard'), enemyBoard: $('enemyBoard'),
  enemyBoardHint: $('enemyBoardHint'), soundBtn: $('soundBtn'), micBtn: $('micBtn'), micText: $('micText'), micIcon: $('micIcon'),
  voiceActionBtn: $('voiceActionBtn'), voiceStatus: $('voiceStatus'), voiceWaves: document.querySelector('.voice-waves'),
  resultModal: $('resultModal'), resultIcon: $('resultIcon'), resultKicker: $('resultKicker'), resultTitle: $('resultTitle'),
  resultText: $('resultText'), rematchBtn: $('rematchBtn'), newRoomBtn: $('newRoomBtn'), rematchNote: $('rematchNote'),
  toast: $('toast'), remoteAudio: $('remoteAudio'), connectionDot: $('connectionDot'), connectionText: $('connectionText')
};

const state = {
  roomCode: null,
  playerId: null,
  playerNumber: null,
  room: null,
  orientation: 'horizontal',
  fleet: [],
  placedIndex: 0,
  myShotsReceived: new Map(),
  enemyShots: new Map(),
  ready: false,
  gameStarted: false,
  soundOn: true,
  localStream: null,
  peerConnection: null,
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  voiceReady: false,
  remoteVoiceReady: false,
  micMuted: false,
  negotiating: false
};

let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function tone(freq, duration, type = 'sine', gain = .08, delay = 0) {
  if (!state.soundOn) return;
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type; osc.frequency.value = freq;
  amp.gain.setValueAtTime(0, ctx.currentTime + delay);
  amp.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + .01);
  amp.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + delay + duration);
  osc.connect(amp); amp.connect(ctx.destination);
  osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + duration + .03);
}
function playSound(name) {
  if (name === 'shot') { tone(170, .12, 'sawtooth', .045); tone(80, .18, 'square', .03, .03); }
  if (name === 'hit') { tone(90, .28, 'sawtooth', .07); tone(52, .36, 'square', .05, .06); }
  if (name === 'miss') { tone(520, .09, 'sine', .04); tone(360, .16, 'sine', .03, .08); }
  if (name === 'sunk') { tone(120, .2, 'sawtooth', .07); tone(80, .28, 'square', .06, .12); tone(52, .4, 'sawtooth', .05, .25); }
  if (name === 'victory') [523,659,784,1046].forEach((f,i) => tone(f,.22,'triangle',.055,i*.12));
  if (name === 'defeat') [330,277,220,165].forEach((f,i) => tone(f,.25,'sawtooth',.04,i*.15));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2300);
}

function getPlayerName() {
  return els.playerName.value.trim().slice(0, 24) || 'Capitão';
}

function inviteUrl() {
  const url = new URL(location.href);
  url.searchParams.set('sala', state.roomCode);
  return url.toString();
}

function enterGame(response) {
  state.roomCode = response.code;
  state.playerId = response.playerId;
  state.playerNumber = response.playerNumber;
  els.roomCode.textContent = response.code;
  els.meName.textContent = getPlayerName();
  els.lobbyScreen.classList.add('hidden');
  els.gameScreen.classList.remove('hidden');
  els.topActions.classList.remove('hidden');
  const url = new URL(location.href);
  url.searchParams.set('sala', response.code);
  history.replaceState({}, '', url);
  renderPlacement();
  updateStatus();
}

els.createBtn.addEventListener('click', () => {
  els.lobbyError.textContent = '';
  socket.emit('create-room', { name: getPlayerName() }, response => {
    if (!response.ok) return els.lobbyError.textContent = response.error || 'Não foi possível criar a sala.';
    enterGame(response);
  });
});

els.joinToggleBtn.addEventListener('click', () => {
  els.joinFields.classList.remove('hidden');
  els.joinBtn.classList.remove('hidden');
  els.joinToggleBtn.classList.add('hidden');
  els.roomInput.focus();
});

els.joinBtn.addEventListener('click', joinRoom);
els.roomInput.addEventListener('keydown', event => { if (event.key === 'Enter') joinRoom(); });
function joinRoom() {
  els.lobbyError.textContent = '';
  const code = els.roomInput.value.trim().toUpperCase();
  if (!code) return els.lobbyError.textContent = 'Digite o código da sala.';
  socket.emit('join-room', { code, name: getPlayerName() }, response => {
    if (!response.ok) return els.lobbyError.textContent = response.error || 'Não foi possível entrar.';
    enterGame(response);
  });
}

els.copyLinkBtn.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(inviteUrl()); showToast('Link da sala copiado!'); }
  catch { showToast(`Sala: ${state.roomCode}`); }
});

function cellKey(row, col) { return `${row}:${col}`; }
function occupiedSet() {
  return new Set(state.fleet.flatMap(ship => ship.cells.map(cell => cellKey(cell.row, cell.col))));
}
function candidateCells(row, col, length) {
  return Array.from({ length }, (_, i) => ({
    row: row + (state.orientation === 'vertical' ? i : 0),
    col: col + (state.orientation === 'horizontal' ? i : 0)
  }));
}
function canPlace(cells) {
  const occupied = occupiedSet();
  return cells.every(cell => cell.row >= 0 && cell.col >= 0 && cell.row < BOARD_SIZE && cell.col < BOARD_SIZE && !occupied.has(cellKey(cell.row, cell.col)));
}

function makeBoard(container, clickHandler, hoverHandler) {
  container.innerHTML = '';
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.type = 'button';
      cell.dataset.row = row; cell.dataset.col = col;
      cell.setAttribute('aria-label', `Linha ${row + 1}, coluna ${col + 1}`);
      if (clickHandler) cell.addEventListener('click', () => clickHandler(row, col));
      if (hoverHandler) {
        cell.addEventListener('mouseenter', () => hoverHandler(row, col));
        cell.addEventListener('mouseleave', clearPreview);
      }
      container.appendChild(cell);
    }
  }
}

function renderPlacement() {
  makeBoard(els.placementBoard, placeCurrentShip, previewShip);
  paintOwnShips(els.placementBoard);
  renderFleetList();
  els.placementCounter.textContent = `${state.fleet.length}/${SHIPS.length} navios`;
  els.readyBtn.disabled = state.fleet.length !== SHIPS.length || state.ready;
}

function renderFleetList() {
  els.fleetList.innerHTML = '';
  SHIPS.forEach((ship, index) => {
    const item = document.createElement('div');
    const placed = state.fleet.some(item => item.id === ship.id);
    item.className = `ship-item ${placed ? 'placed' : ''} ${index === state.placedIndex && !placed ? 'current' : ''}`;
    item.innerHTML = `<div class="ship-name"><strong>${ship.name}</strong><span>${ship.length} casas</span></div><div class="ship-dots">${'<i></i>'.repeat(ship.length)}</div>`;
    els.fleetList.appendChild(item);
  });
}

function paintOwnShips(container) {
  const shipCells = occupiedSet();
  container.querySelectorAll('.cell').forEach(cell => {
    cell.classList.toggle('ship', shipCells.has(cellKey(Number(cell.dataset.row), Number(cell.dataset.col))));
  });
}

function clearPreview() {
  els.placementBoard.querySelectorAll('.cell').forEach(cell => cell.classList.remove('preview', 'preview-invalid'));
}
function previewShip(row, col) {
  clearPreview();
  if (state.ready || state.placedIndex >= SHIPS.length) return;
  const cells = candidateCells(row, col, SHIPS[state.placedIndex].length);
  const valid = canPlace(cells);
  for (const coord of cells) {
    const cell = els.placementBoard.querySelector(`[data-row="${coord.row}"][data-col="${coord.col}"]`);
    if (cell) cell.classList.add(valid ? 'preview' : 'preview-invalid');
  }
}
function placeCurrentShip(row, col) {
  if (state.ready || state.placedIndex >= SHIPS.length) return;
  const ship = SHIPS[state.placedIndex];
  const cells = candidateCells(row, col, ship.length);
  if (!canPlace(cells)) return showToast('Esse navio não cabe aí.');
  state.fleet.push({ id: ship.id, cells });
  state.placedIndex += 1;
  renderPlacement();
}

els.rotateBtn.addEventListener('click', () => {
  state.orientation = state.orientation === 'horizontal' ? 'vertical' : 'horizontal';
  els.rotateBtn.textContent = state.orientation === 'horizontal' ? '↻ Horizontal' : '↻ Vertical';
});
els.resetBtn.addEventListener('click', resetFleet);
function resetFleet() {
  if (state.ready) return;
  state.fleet = []; state.placedIndex = 0; renderPlacement();
}
els.randomBtn.addEventListener('click', randomFleet);
function randomFleet() {
  if (state.ready) return;
  state.fleet = [];
  for (const ship of SHIPS) {
    let placed = false;
    while (!placed) {
      state.orientation = Math.random() > .5 ? 'horizontal' : 'vertical';
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);
      const cells = candidateCells(row, col, ship.length);
      if (canPlace(cells)) { state.fleet.push({ id: ship.id, cells }); placed = true; }
    }
  }
  state.placedIndex = SHIPS.length;
  els.rotateBtn.textContent = state.orientation === 'horizontal' ? '↻ Horizontal' : '↻ Vertical';
  renderPlacement();
}

els.readyBtn.addEventListener('click', () => {
  if (state.fleet.length !== SHIPS.length) return;
  socket.emit('submit-fleet', { fleet: state.fleet }, response => {
    if (!response.ok) return showToast(response.error || 'Frota inválida.');
    state.ready = true;
    els.readyBtn.disabled = true;
    els.randomBtn.disabled = true;
    els.resetBtn.disabled = true;
    els.rotateBtn.disabled = true;
    updateStatus();
  });
});

function renderBattleBoards() {
  makeBoard(els.myBoard);
  makeBoard(els.enemyBoard, fireAt);
  paintOwnShips(els.myBoard);
  updateShotMarks();
}
function updateShotMarks() {
  els.myBoard.querySelectorAll('.cell').forEach(cell => {
    const key = cellKey(Number(cell.dataset.row), Number(cell.dataset.col));
    const result = state.myShotsReceived.get(key);
    if (result) cell.classList.add(result.hit ? 'hit' : 'miss');
  });
  els.enemyBoard.querySelectorAll('.cell').forEach(cell => {
    const key = cellKey(Number(cell.dataset.row), Number(cell.dataset.col));
    const result = state.enemyShots.get(key);
    if (result) cell.classList.add(result.hit ? 'hit' : 'miss');
  });
}
function fireAt(row, col) {
  if (!state.gameStarted || !state.room || state.room.turnPlayerId !== state.playerId) return;
  const key = cellKey(row, col);
  if (state.enemyShots.has(key)) return;
  playSound('shot');
  els.enemyBoard.classList.remove('turn');
  socket.emit('fire', { row, col }, response => {
    if (!response.ok) { updateStatus(); return showToast(response.error || 'Tiro inválido.'); }
  });
}

function updateStatus() {
  const room = state.room;
  const opponent = room?.players?.find(player => player.id !== state.playerId);
  const me = room?.players?.find(player => player.id === state.playerId);
  if (me) {
    els.meName.textContent = me.name;
    els.meReady.textContent = me.ready ? 'Pronto' : 'Preparando';
    els.meReady.classList.toggle('ready', me.ready);
  }
  if (opponent) {
    els.opponentName.textContent = opponent.name;
    els.opponentReady.textContent = opponent.ready ? 'Pronto' : 'Preparando';
    els.opponentReady.classList.toggle('ready', opponent.ready);
  } else {
    els.opponentName.textContent = 'Aguardando...';
    els.opponentReady.textContent = 'Offline';
    els.opponentReady.classList.remove('ready');
  }

  if (!opponent) {
    els.statusIcon.textContent = '⌛'; els.statusKicker.textContent = 'SALA CRIADA';
    els.statusTitle.textContent = 'Aguardando adversário'; els.statusText.textContent = 'Copie o convite e envie para a outra pessoa.';
  } else if (!state.gameStarted) {
    els.statusIcon.textContent = state.ready ? '✅' : '⚓'; els.statusKicker.textContent = 'PREPARAÇÃO';
    els.statusTitle.textContent = state.ready ? 'Frota pronta' : 'Posicione sua frota';
    els.statusText.textContent = state.ready ? 'Aguardando o adversário finalizar o posicionamento.' : 'Posicione os 5 navios e confirme quando estiver pronto.';
  } else if (room?.status === 'playing') {
    const myTurn = room.turnPlayerId === state.playerId;
    els.statusIcon.textContent = myTurn ? '🎯' : '🛡️'; els.statusKicker.textContent = myTurn ? 'ATAQUE' : 'DEFESA';
    els.statusTitle.textContent = myTurn ? 'Sua vez de atacar' : `Vez de ${opponent?.name || 'seu adversário'}`;
    els.statusText.textContent = myTurn ? 'Escolha uma posição no oceano inimigo.' : 'Aguarde o tiro do adversário.';
    els.enemyBoardHint.textContent = myTurn ? 'Escolha seu alvo' : 'Aguarde sua vez';
    els.enemyBoard.classList.toggle('turn', myTurn);
    els.meCard.classList.toggle('active-player', myTurn);
    els.opponentCard.classList.toggle('active-player', !myTurn);
  }
}

socket.on('room-state', room => {
  state.room = room;
  const me = room.players?.find(player => player.id === state.playerId);
  if (me?.number) state.playerNumber = me.number;
  updateStatus();
  maybeStartVoiceOffer();
});
socket.on('opponent-joined', ({ name }) => { showToast(`${name} entrou na sala.`); updateStatus(); });
socket.on('game-started', ({ turnPlayerId }) => {
  state.gameStarted = true;
  state.myShotsReceived.clear(); state.enemyShots.clear();
  els.placementPanel.classList.add('hidden'); els.battlePanel.classList.remove('hidden');
  renderBattleBoards();
  if (state.room) { state.room.status = 'playing'; state.room.turnPlayerId = turnPlayerId; }
  updateStatus(); showToast('A batalha começou!');
});
socket.on('shot-result', result => {
  const key = cellKey(result.row, result.col);
  if (result.shooterId === state.playerId) state.enemyShots.set(key, result);
  else state.myShotsReceived.set(key, result);
  updateShotMarks();

  if (result.hit) playSound(result.sunkShipId ? 'sunk' : 'hit');
  else playSound('miss');

  if (state.room && !result.won) state.room.turnPlayerId = result.targetId;
  updateStatus();

  if (result.won) showResult(result.shooterId === state.playerId);
  else if (result.shooterId === state.playerId) showToast(result.hit ? (result.sunkShipId ? 'Navio afundado!' : 'Acertou!') : 'Água!');
  else showToast(result.hit ? 'Seu navio foi atingido!' : 'O adversário errou.');
});

function showResult(won) {
  state.gameStarted = false;
  playSound(won ? 'victory' : 'defeat');
  els.resultIcon.textContent = won ? '🏆' : '💥';
  els.resultKicker.textContent = 'FIM DE JOGO';
  els.resultTitle.textContent = won ? 'Vitória!' : 'Derrota';
  els.resultText.textContent = won ? 'Você afundou toda a frota inimiga.' : 'Sua frota foi completamente afundada.';
  els.rematchNote.textContent = '';
  els.resultModal.classList.remove('hidden');
}

els.rematchBtn.addEventListener('click', () => {
  els.rematchBtn.disabled = true;
  els.rematchNote.textContent = 'Aguardando o adversário aceitar a revanche...';
  socket.emit('request-rematch', {}, response => { if (!response.ok) els.rematchBtn.disabled = false; });
});
socket.on('rematch-status', ({ playerId }) => {
  if (playerId !== state.playerId) els.rematchNote.textContent = 'O adversário quer revanche. Clique em “Jogar novamente”.';
});
socket.on('rematch-start', () => {
  state.ready = false; state.gameStarted = false; state.fleet = []; state.placedIndex = 0;
  state.myShotsReceived.clear(); state.enemyShots.clear();
  els.resultModal.classList.add('hidden'); els.rematchBtn.disabled = false; els.rematchNote.textContent = '';
  els.placementPanel.classList.remove('hidden'); els.battlePanel.classList.add('hidden');
  els.randomBtn.disabled = false; els.resetBtn.disabled = false; els.rotateBtn.disabled = false;
  renderPlacement(); updateStatus();
});
els.newRoomBtn.addEventListener('click', () => { location.href = location.origin; });

socket.on('opponent-left', ({ name }) => {
  showToast(`${name || 'O adversário'} saiu da sala.`);
  state.ready = false; state.gameStarted = false; state.fleet = []; state.placedIndex = 0;
  els.resultModal.classList.add('hidden'); els.battlePanel.classList.add('hidden'); els.placementPanel.classList.remove('hidden');
  els.randomBtn.disabled = false; els.resetBtn.disabled = false; els.rotateBtn.disabled = false;
  closeVoice(); renderPlacement(); updateStatus();
});

socket.on('connect', () => { els.connectionText.textContent = 'Conectado'; els.connectionDot.style.background = ''; });
socket.on('disconnect', () => { els.connectionText.textContent = 'Reconectando...'; els.connectionDot.style.background = '#ff4d5d'; });

els.soundBtn.addEventListener('click', () => {
  state.soundOn = !state.soundOn;
  els.soundBtn.textContent = state.soundOn ? '🔊' : '🔇';
  if (state.soundOn) tone(660, .08, 'sine', .035);
});

async function loadIceConfig() {
  try {
    const response = await fetch('/config');
    const config = await response.json();
    if (Array.isArray(config.iceServers)) state.iceServers = config.iceServers;
  } catch {}
}
loadIceConfig();

els.micBtn.addEventListener('click', toggleVoice);
els.voiceActionBtn.addEventListener('click', toggleVoice);
async function toggleVoice() {
  if (!state.roomCode) return;
  if (!state.localStream) {
    try {
      state.localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      state.voiceReady = true; state.micMuted = false;
      socket.emit('voice-ready', { ready: true });
      updateVoiceUi('Microfone ligado • aguardando conexão');
      maybeStartVoiceOffer();
    } catch (error) {
      showToast('Não foi possível acessar o microfone.');
      updateVoiceUi('Permissão de microfone negada');
    }
    return;
  }
  state.micMuted = !state.micMuted;
  state.localStream.getAudioTracks().forEach(track => { track.enabled = !state.micMuted; });
  updateVoiceUi(state.micMuted ? 'Microfone silenciado' : (state.peerConnection ? 'Voz conectada' : 'Microfone ligado'));
}

function updateVoiceUi(text) {
  els.voiceStatus.textContent = text;
  const enabled = Boolean(state.localStream) && !state.micMuted;
  els.micIcon.textContent = enabled ? '🎙️' : '🔇';
  els.micText.textContent = !state.localStream ? 'Ligar voz' : (state.micMuted ? 'Ativar voz' : 'Silenciar');
  els.voiceActionBtn.textContent = !state.localStream ? '🎙️ Ligar microfone' : (state.micMuted ? '🎙️ Ativar microfone' : '🔇 Silenciar');
  els.voiceWaves?.classList.toggle('active', text.includes('conectada') && !state.micMuted);
}

function createPeerConnection() {
  if (state.peerConnection) return state.peerConnection;
  const pc = new RTCPeerConnection({ iceServers: state.iceServers });
  state.peerConnection = pc;
  if (state.localStream) state.localStream.getTracks().forEach(track => pc.addTrack(track, state.localStream));
  pc.ontrack = event => {
    els.remoteAudio.srcObject = event.streams[0];
    els.remoteAudio.play().catch(() => {});
    updateVoiceUi(state.micMuted ? 'Voz conectada • seu microfone silenciado' : 'Voz conectada');
  };
  pc.onicecandidate = event => {
    if (event.candidate) socket.emit('webrtc-signal', { type: 'ice', data: event.candidate });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') updateVoiceUi(state.micMuted ? 'Voz conectada • seu microfone silenciado' : 'Voz conectada');
    if (['failed','disconnected'].includes(pc.connectionState)) updateVoiceUi('Voz desconectada');
  };
  return pc;
}

async function maybeStartVoiceOffer() {
  const opponent = state.room?.players?.find(player => player.id !== state.playerId);
  if (!state.localStream || !opponent?.voiceReady || state.playerNumber !== 1 || state.negotiating) return;
  state.remoteVoiceReady = true;
  const pc = createPeerConnection();
  if (pc.signalingState !== 'stable') return;
  state.negotiating = true;
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc-signal', { type: 'offer', data: pc.localDescription });
  } finally { state.negotiating = false; }
}

socket.on('voice-peer-ready', ({ ready }) => {
  state.remoteVoiceReady = Boolean(ready);
  if (ready) {
    if (state.localStream) updateVoiceUi('Microfone ligado • conectando voz...');
    maybeStartVoiceOffer();
  }
});
socket.on('webrtc-signal', async ({ type, data }) => {
  try {
    const pc = createPeerConnection();
    if (type === 'offer') {
      await pc.setRemoteDescription(data);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-signal', { type: 'answer', data: pc.localDescription });
    } else if (type === 'answer') {
      await pc.setRemoteDescription(data);
    } else if (type === 'ice' && data) {
      await pc.addIceCandidate(data);
    }
  } catch (error) {
    console.warn('Falha WebRTC:', error);
  }
});

function closeVoice() {
  if (state.peerConnection) state.peerConnection.close();
  state.peerConnection = null; state.remoteVoiceReady = false;
  els.remoteAudio.srcObject = null;
  if (state.localStream) {
    socket.emit('voice-ready', { ready: true });
    updateVoiceUi(state.micMuted ? 'Microfone silenciado' : 'Microfone ligado • aguardando adversário');
  } else updateVoiceUi('Microfone desligado');
}

const urlRoom = new URLSearchParams(location.search).get('sala');
if (urlRoom) {
  els.joinFields.classList.remove('hidden'); els.joinBtn.classList.remove('hidden'); els.joinToggleBtn.classList.add('hidden');
  els.roomInput.value = urlRoom.toUpperCase();
}
