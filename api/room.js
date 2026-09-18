import crypto from 'node:crypto';
import { getRedis } from '../lib/store.js';
import * as Game from '../lib/game-engine.js';

const TTL = 60 * 60 * 6;
const PRESENCE_TTL = 18;
const ROOM_PREFIX = 'ludo:v4:room:';
const MAP_PREFIX = 'ludo:v4:clientroom:';
const PRESENCE_PREFIX = 'ludo:v4:presence:';
const LOCK_PREFIX = 'ludo:v4:lock:';

const roomKey = code => `${ROOM_PREFIX}${code}`;
const mapKey = id => `${MAP_PREFIX}${id}`;
const presenceKey = (code,id) => `${PRESENCE_PREFIX}${code}:${id}`;
const lockKey = code => `${LOCK_PREFIX}${code}`;

function cleanCode(v){ return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8); }
function cleanId(v){ return String(v||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80); }
function randomCode(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join(''); }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function bump(room){ room.updatedAt=Date.now(); room.state.serverRevision=(room.state.serverRevision||0)+1; }

async function loadRoom(redis, code){
  return await redis.get(roomKey(code));
}

async function saveRoom(redis, room){
  await redis.set(roomKey(room.code), room, { ex: TTL });
}

async function touchPresence(redis, code, id){
  if (!code || !id) return;
  await redis.set(presenceKey(code,id), '1', { ex: PRESENCE_TTL });
  await redis.set(mapKey(id), code, { ex: TTL });
}

async function publicState(redis, room){
  const ids = room.state.players.map(p=>presenceKey(room.code,p.id));
  const presence = ids.length ? await redis.mget(...ids) : [];
  return {
    ...room.state,
    players: room.state.players.map((p,i)=>({ ...p, connected: presence[i] != null }))
  };
}

async function withLock(redis, code, fn){
  const key=lockKey(code), token=crypto.randomUUID();
  for(let i=0;i<50;i++){
    const ok=await redis.set(key,token,{nx:true,px:5000});
    if(ok){
      try { return await fn(); }
      finally {
        try { const current=await redis.get(key); if(current===token) await redis.del(key); } catch {}
      }
    }
    await sleep(35);
  }
  const err=new Error('ROOM_BUSY'); err.code='ROOM_BUSY'; throw err;
}

function jsonBody(req){
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch {} }
  return {};
}

function errorMessage(err){
  if(err?.code==='REDIS_NOT_CONFIGURED') return 'Banco Redis não configurado na Vercel.';
  if(err?.code==='ROOM_BUSY') return 'A sala está ocupada. Tente novamente.';
  return 'Erro no servidor do jogo.';
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');

  try{
    const redis=getRedis();

    if(req.method==='GET'){
      const code=cleanCode(req.query?.roomCode || req.query?.room);
      const clientId=cleanId(req.query?.clientId);
      if(!code || !clientId) return res.status(400).json({ok:false,error:'Sala ou jogador inválido.'});
      const room=await loadRoom(redis,code);
      if(!room) return res.status(404).json({ok:false,error:'Sala não encontrada ou encerrada.'});
      const me=room.state.players.find(p=>p.id===clientId);
      if(!me) return res.status(403).json({ok:false,error:'Você não faz parte desta sala.'});
      await touchPresence(redis,code,clientId);
      return res.status(200).json({ok:true,state:await publicState(redis,room)});
    }

    if(req.method!=='POST') return res.status(405).json({ok:false,error:'Método não permitido.'});

    const body=jsonBody(req);
    const action=String(body.action||'');
    const clientId=cleanId(body.clientId);
    const code=cleanCode(body.roomCode);
    if(!clientId) return res.status(400).json({ok:false,error:'Identificador inválido.'});

    if(action==='create'){
      const oldCode=cleanCode(await redis.get(mapKey(clientId)) || '');
      if(oldCode){
        const old=await loadRoom(redis,oldCode);
        const host=old?.state?.players?.find(p=>p.id===clientId && p.host);
        if(old && host){
          await touchPresence(redis,oldCode,clientId);
          return res.status(200).json({ok:true,roomCode:oldCode,state:await publicState(redis,old),reconnected:true});
        }
      }

      let room=null, newCode='';
      for(let i=0;i<30;i++){
        newCode=randomCode();
        const player={id:clientId,name:'Jogador 1',host:true,color:'red'};
        room={code:newCode,state:{phase:'lobby',roomCode:newCode,players:[player],serverRevision:1},createdAt:Date.now(),updatedAt:Date.now()};
        const ok=await redis.set(roomKey(newCode),room,{nx:true,ex:TTL});
        if(ok) break;
        room=null;
      }
      if(!room) return res.status(500).json({ok:false,error:'Não foi possível criar a sala.'});
      await touchPresence(redis,newCode,clientId);
      return res.status(200).json({ok:true,roomCode:newCode,state:await publicState(redis,room)});
    }

    if(action==='join'){
      if(!code) return res.status(400).json({ok:false,error:'Código da sala inválido.'});
      const room=await withLock(redis,code,async()=>{
        const current=await loadRoom(redis,code);
        if(!current){ const e=new Error('Sala não encontrada ou encerrada.'); e.user=true; throw e; }
        let p=current.state.players.find(x=>x.id===clientId);
        if(!p){
          if(current.state.phase!=='lobby'){ const e=new Error('Essa partida já começou.'); e.user=true; throw e; }
          if(current.state.players.length>=4){ const e=new Error('A sala está cheia.'); e.user=true; throw e; }
          const n=current.state.players.length+1;
          p={id:clientId,name:`Jogador ${n}`,host:false,color:Game.COLORS[current.state.players.length]};
          current.state.players.push(p); bump(current); await saveRoom(redis,current);
        }
        return current;
      });
      await touchPresence(redis,code,clientId);
      return res.status(200).json({ok:true,state:await publicState(redis,room)});
    }

    if(!code) return res.status(400).json({ok:false,error:'Código da sala inválido.'});
    await touchPresence(redis,code,clientId);

    if(action==='start'){
      const room=await withLock(redis,code,async()=>{
        const current=await loadRoom(redis,code);
        if(!current){ const e=new Error('Sala não encontrada.'); e.user=true; throw e; }
        const me=current.state.players.find(p=>p.id===clientId);
        if(!me?.host){ const e=new Error('Somente o dono pode iniciar.'); e.user=true; throw e; }
        if(current.state.phase!=='lobby'){ const e=new Error('A partida já começou.'); e.user=true; throw e; }
        const presence=await redis.mget(...current.state.players.map(p=>presenceKey(code,p.id)));
        const online=presence.filter(Boolean).length;
        if(current.state.players.length<2 || online<2){ const e=new Error('Aguarde pelo menos mais 1 jogador conectado.'); e.user=true; throw e; }
        const rev=(current.state.serverRevision||0)+1;
        const players=current.state.players.map(p=>({...p,connected:true}));
        current.state=Game.newGame(players);
        current.state.roomCode=code; current.state.serverRevision=rev; current.updatedAt=Date.now();
        await saveRoom(redis,current); return current;
      });
      return res.status(200).json({ok:true,state:await publicState(redis,room)});
    }

    if(action==='roll' || action==='move'){
      const room=await withLock(redis,code,async()=>{
        const current=await loadRoom(redis,code);
        if(!current){ const e=new Error('Sala não encontrada.'); e.user=true; throw e; }
        if(!current.state.players.some(p=>p.id===clientId)){ const e=new Error('Sessão inválida.'); e.user=true; throw e; }
        let result;
        if(action==='roll') result=Game.roll(current.state,clientId);
        else result=Game.move(current.state,clientId,String(body.pieceId||''));
        if(!result.ok){ const e=new Error(result.error||'Jogada inválida.'); e.user=true; throw e; }
        bump(current); await saveRoom(redis,current);
        current._result=result; return current;
      });
      return res.status(200).json({ok:true,result:room._result,state:await publicState(redis,room)});
    }

    return res.status(400).json({ok:false,error:'Ação inválida.'});
  }catch(err){
    console.error('room api error',err);
    const status=err?.user?400:(err?.code==='REDIS_NOT_CONFIGURED'?503:500);
    return res.status(status).json({ok:false,error:err?.user?err.message:errorMessage(err),code:err?.code||undefined});
  }
}
