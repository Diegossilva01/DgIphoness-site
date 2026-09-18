(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.LudoEngine=api;
})(typeof self!=='undefined'?self:this,function(){
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
      phase:'playing',
      roomCode: players.roomCode || undefined,
      players:players.map((p,i)=>({...p,color:colorOfPlayer(i),finished:false,connected:p.connected!==false})),
      pieces:players.flatMap((p,i)=>Array.from({length:4},(_,piece)=>({
        id:`${p.id}-${piece}`, playerId:p.id, color:colorOfPlayer(i), piece,
        progress:-1
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
    const pid=currentPlayer(game).id;
    return piecesForPlayer(game,pid).filter(p=>canMovePiece(p,game.dice));
  }

  function nextTurn(game){
    if(game.players.length < 2) return;
    let tries=0;
    do{ game.turn=(game.turn+1)%game.players.length; tries++; }
    while(game.players[game.turn].finished && tries<game.players.length+1);
    game.dice=null; game.rolled=false; game.serial++;
  }

  function roll(game,playerId,forcedValue){
    if(game.phase!=='playing' || game.winner) return {ok:false,error:'A partida terminou.'};
    if(currentPlayer(game).id!==playerId) return {ok:false,error:'Não é sua vez.'};
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
    if(currentPlayer(game).id!==playerId) return {ok:false,error:'Não é sua vez.'};
    const piece=game.pieces.find(p=>p.id===pieceId && p.playerId===playerId);
    if(!piece || !canMovePiece(piece,game.dice)) return {ok:false,error:'Movimento inválido.'};

    const rolled=game.dice;
    if(piece.progress===-1) piece.progress=0;
    else piece.progress += rolled;

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

  return {COLORS,COLOR_LABELS,PATH,LANES,YARDS,START_OFFSET,SAFE_GLOBAL,newGame,coordForPiece,currentPlayer,movablePieces,roll,move,piecesForPlayer};
});
