import { Chess } from './vendor/chess.js';
export const DEFAULTS = {theme:'wood',responseDelay:0,animationDuration:600,sound:false,stake:'100',base:600,increment:5,difficulty:'1320',color:'w',openingDepth:2,openingRank:'0',multipliers:{'1320':'2','2000':'3','2800':'5','3190':'8',MAX:'10'}};
export const uci = m => m.from + m.to + (m.promotion || '');
export function chessFor(game, ply = game.moves.length) {
 const chess = new Chess(); for(const m of game.moves.slice(0,ply)) chess.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]}); return chess;
}
export function integer(value, name='Integer', allowNegative=false) {
 if(typeof value !== 'string' || !(allowNegative ? /^-?\d+$/ : /^\d+$/).test(value)) throw Error(`${name} must be an integer`);
 return BigInt(value).toString();
}
export function newGame(profile, prefs, mode='rated', opening=[], now=Date.now()) {
 const stake=integer(prefs.stake,'Stake'); const multiplier=integer(prefs.multipliers[prefs.difficulty],'Multiplier');
 if(!['rated','analysis','arena'].includes(mode)) throw Error('Invalid mode');
 if(!Number.isFinite(prefs.base)||prefs.base<1||prefs.base>86400||!Number.isFinite(prefs.increment)||prefs.increment<0||prefs.increment>3600) throw Error('Clock outside supported limits');
 const game={id:crypto.randomUUID(),profileId:profile.id,mode,premoves:[],moves:[...opening],openingPlies:opening.length,created:now,updated:now,finished:null,status:'active',result:'*',reason:'',stake,multiplier,difficulty:prefs.difficulty,player:prefs.color,clock:{base:prefs.base,increment:prefs.increment,w:prefs.base*1000,b:prefs.base*1000,since:now,paused:false},settled:false,revision:0,startingBalance:profile.balance,endingBalance:null};
 chessFor(game); return game;
}
export function remaining(game, now=Date.now()) {
 const c=game.clock, side=chessFor(game).turn();
 return {w:Math.max(0,c.w-(!c.paused && game.status==='active' && side==='w'?Math.max(0,now-c.since):0)),b:Math.max(0,c.b-(!c.paused && game.status==='active' && side==='b'?Math.max(0,now-c.since):0))};
}
export function debit(game, now=Date.now()) { const left=remaining(game,now); Object.assign(game.clock,left,{since:now}); return left; }
export function materialCanMate(chess, side) {
 if(chess.isInsufficientMaterial()) return false;
 const own=chess.board().flat().filter(p=>p?.color===side && p.type!=='k');
 const other=chess.board().flat().filter(p=>p?.color!==side && p && p.type!=='k');
 if(!own.length) return false;
 if(own.some(p=>'pqr'.includes(p.type))) return true;
 // A lone minor cannot mate a bare king; opposing material can enable a helpmate.
 if(own.length===1 && !other.length) return false;
 return true;
}
export function finish(game,result,reason,now=Date.now()) {
 if(game.status!=='active') return false;
 debit(game,now); Object.assign(game,{premoves:[],status:'finished',result,reason,finished:now,updated:now});game.clock.paused=true;game.revision++;return true;
}
export function timeout(game,now=Date.now()) {
 if(game.status!=='active'||game.clock.paused) return false;
 const chess=chessFor(game),side=chess.turn();
 if(remaining(game,now)[side]>0) return false;
 const winner=side==='w'?'b':'w';
 return finish(game,materialCanMate(chess,winner)?(winner==='w'?'1-0':'0-1'):'1/2-1/2','Time expired'+(materialCanMate(chess,winner)?'':' · no mating material'),now);
}
export function occurrences(game) {
 const chess=new Chess(),counts=new Map();
 function key(){return chess.fen().split(' ').slice(0,4).join(' ');}
 counts.set(key(),1);
 for(const m of game.moves){chess.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]});const k=key();counts.set(k,(counts.get(k)||0)+1);}
 return counts.get(key())||1;
}
export function adjudicate(game,now=Date.now()) {
 const c=chessFor(game);
 if(c.isCheckmate()) return finish(game,c.turn()==='w'?'0-1':'1-0','Checkmate',now);
 if(c.isStalemate()) return finish(game,'1/2-1/2','Stalemate',now);
 if(c.isInsufficientMaterial()) return finish(game,'1/2-1/2','Insufficient material',now);
 if(Number(c.fen().split(' ')[4])>=150) return finish(game,'1/2-1/2','75-move rule',now);
 if(occurrences(game)>=5) return finish(game,'1/2-1/2','Fivefold repetition',now);
 return false;
}
export function claimable(game) { const c=chessFor(game);return c.isThreefoldRepetition()||Number(c.fen().split(' ')[4])>=100; }
export function play(game,move,now=Date.now()) {
 if(game.status!=='active'||game.clock.paused) throw Error('Game is not running');
 if(timeout(game,now)) return null;
 const c=chessFor(game),side=c.turn();const legal=c.move(move); // Validate before clock mutation.
 debit(game,now);game.moves.push(uci(legal));game.clock[side]+=game.clock.increment*1000;game.clock.since=now;game.updated=now;game.revision++;adjudicate(game,now);return legal;
}
export function payout(game) {
 if(game.mode!=='rated'||game.status!=='finished'||game.result==='1/2-1/2') return 0n;
 const won=game.result===(game.player==='w'?'1-0':'0-1');return won?BigInt(game.stake)*BigInt(game.multiplier):-BigInt(game.stake);
}
export function pgn(game) {
 const c=chessFor(game);c.header('Event',`Stockfish 19 Credit Chess (${game.mode})`,'White',game.mode==='arena'||game.player==='b'?'Stockfish 19':'Local player','Black',game.mode==='arena'||game.player==='w'?'Stockfish 19':'Local player','Result',game.result,'Date',new Date(game.created).toISOString().slice(0,10).replaceAll('-','.'),'TimeControl',`${game.clock.base}+${game.clock.increment}`,'Termination',game.reason||'In progress');return c.pgn();
}
