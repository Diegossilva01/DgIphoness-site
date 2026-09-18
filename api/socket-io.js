import http from 'node:http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import * as Game from '../lib/game-engine.js';

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) throw new Error('REDIS_URL não configurada. Adicione Redis ao projeto na Vercel.');

const store = createClient({ url: REDIS_URL });
const pub = store.duplicate();
const sub = store.duplicate();
await Promise.all([store.connect(), pub.connect(), sub.connect()]);

const server = http.createServer();
const io = new Server(server, { transports:['websocket'], pingInterval:20000, pingTimeout:20000 });
io.adapter(createAdapter(pub, sub));

const TTL = 60 * 60 * 6;
const roomKey = code => `ludo:room:${code}`;
const mapKey = id => `ludo:clientroom:${id}`;
const presenceKey = (code,id) => `ludo:presence:${code}:${id}`;
const lockKey = code => `ludo:lock:${code}`;
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function cleanCode(v){ return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8); }
function cleanId(v){ return String(v||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80); }
function randomCode(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join(''); }
async function loadRoom(code){ const raw=await store.get(roomKey(code)); return raw?JSON.parse(raw):null; }
async function saveRoom(room){ await store.set(roomKey(room.code), JSON.stringify(room), { EX: TTL }); }
async function withLock(code, fn){ const token=crypto.randomUUID(); for(let i=0;i<50;i++){ const ok=await store.set(lockKey(code),token,{NX:true,PX:4000}); if(ok){ try{return await fn();} finally{ await store.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",{keys:[lockKey(code)],arguments:[token]}); } } await sleep(30); } throw new Error('Sala ocupada. Tente novamente.'); }
function bump(room){ room.updatedAt=Date.now(); room.state.serverRevision=(room.state.serverRevision||0)+1; }
function publicState(room){ return room.state; }
function connectedCount(room){ return room.state.players.filter(p=>p.connected!==false).length; }
async function attach(room, player, socket){ socket.data.roomCode=room.code; socket.data.clientId=player.id; await socket.join(room.code); await store.set(presenceKey(room.code,player.id),socket.id,{EX:TTL}); await store.set(mapKey(player.id),room.code,{EX:TTL}); }
function broadcast(room){ io.to(room.code).emit('room-state',{state:publicState(room)}); }

io.on('connection', socket => {
  socket.on('create-room', async (payload={}, ack=()=>{}) => {
    try{
      const clientId=cleanId(payload.clientId); if(!clientId)return ack({ok:false,error:'Identificador inválido.'});
      const oldCode=await store.get(mapKey(clientId));
      if(oldCode){ const old=await loadRoom(oldCode); const p=old?.state?.players?.find(x=>x.id===clientId&&x.host); if(old&&p){ await withLock(old.code,async()=>{const r=await loadRoom(old.code); const pp=r.state.players.find(x=>x.id===clientId); pp.connected=true; bump(r); await saveRoom(r); await attach(r,pp,socket); broadcast(r); ack({ok:true,roomCode:r.code,state:r.state,reconnected:true});}); return; } }
      let code, room; for(let i=0;i<20;i++){ code=randomCode(); const player={id:clientId,name:'Jogador 1',host:true,color:'red',connected:true}; room={code,state:{phase:'lobby',roomCode:code,players:[player],serverRevision:1},createdAt:Date.now(),updatedAt:Date.now()}; const ok=await store.set(roomKey(code),JSON.stringify(room),{NX:true,EX:TTL}); if(ok)break; room=null; }
      if(!room)return ack({ok:false,error:'Não foi possível criar a sala.'});
      await attach(room,room.state.players[0],socket); ack({ok:true,roomCode:code,state:room.state}); broadcast(room);
    }catch(e){console.error(e);ack({ok:false,error:'Erro ao criar sala.'});}
  });

  socket.on('join-room', async (payload={}, ack=()=>{}) => {
    try{
      const code=cleanCode(payload.roomCode), clientId=cleanId(payload.clientId); if(!clientId)return ack({ok:false,error:'Identificador inválido.'});
      await withLock(code, async()=>{ const room=await loadRoom(code); if(!room)return ack({ok:false,error:'Sala não encontrada ou encerrada.'}); let p=room.state.players.find(x=>x.id===clientId); if(!p){ if(room.state.phase!=='lobby')return ack({ok:false,error:'Essa partida já começou.'}); if(room.state.players.length>=4)return ack({ok:false,error:'A sala está cheia.'}); const n=room.state.players.length+1; p={id:clientId,name:`Jogador ${n}`,host:false,color:Game.COLORS[room.state.players.length],connected:true}; room.state.players.push(p); } else p.connected=true; bump(room); await saveRoom(room); await attach(room,p,socket); ack({ok:true,state:room.state}); broadcast(room); });
    }catch(e){console.error(e);ack({ok:false,error:'Erro ao entrar na sala.'});}
  });

  socket.on('start-game', async (payload={}, ack=()=>{}) => {
    try{ const code=cleanCode(payload.roomCode), id=cleanId(payload.clientId); await withLock(code,async()=>{ const room=await loadRoom(code); if(!room)return ack({ok:false,error:'Sala não encontrada.'}); const me=room.state.players.find(p=>p.id===id); if(!me?.host)return ack({ok:false,error:'Somente o dono pode iniciar.'}); if(room.state.phase!=='lobby')return ack({ok:false,error:'A partida já começou.'}); if(room.state.players.length<2||connectedCount(room)<2)return ack({ok:false,error:'Aguarde pelo menos mais 1 jogador.'}); const rev=(room.state.serverRevision||0)+1; const players=room.state.players.map(p=>({...p})); room.state=Game.newGame(players); room.state.roomCode=code; room.state.serverRevision=rev; room.updatedAt=Date.now(); await saveRoom(room); ack({ok:true}); broadcast(room); }); }catch(e){console.error(e);ack({ok:false,error:'Erro ao iniciar partida.'});}
  });

  socket.on('game-action', async (payload={}, ack=()=>{}) => {
    try{ const code=cleanCode(payload.roomCode), id=cleanId(payload.clientId); if(socket.data.roomCode!==code||socket.data.clientId!==id)return ack({ok:false,error:'Sessão inválida.'}); await withLock(code,async()=>{ const room=await loadRoom(code); if(!room)return ack({ok:false,error:'Sala não encontrada.'}); let result; if(payload.action==='roll')result=Game.roll(room.state,id); else if(payload.action==='move')result=Game.move(room.state,id,payload.payload?.pieceId); else return ack({ok:false,error:'Ação inválida.'}); if(!result.ok)return ack(result); bump(room); await saveRoom(room); ack(result); broadcast(room); }); }catch(e){console.error(e);ack({ok:false,error:'Erro ao processar jogada.'});}
  });

  socket.on('disconnect', async()=>{
    try{ const code=socket.data.roomCode, id=socket.data.clientId; if(!code||!id)return; const current=await store.get(presenceKey(code,id)); if(current!==socket.id)return; await store.del(presenceKey(code,id)); await withLock(code,async()=>{const room=await loadRoom(code); if(!room)return; const p=room.state.players.find(x=>x.id===id); if(!p)return; p.connected=false; bump(room); await saveRoom(room); broadcast(room);}); }catch(e){console.error(e);}
  });
});

export default server;
