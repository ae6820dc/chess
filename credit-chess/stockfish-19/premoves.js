// Intentions are deliberately not Chess positions: no opponent turns are invented.
// Only execution against the real game may establish legality (including check).
import {chessFor,play} from './core.js';
export const validIntent=m=>typeof m==='string'&&/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m)&&m.slice(0,2)!==m.slice(2,4);
export class Plan {
 constructor(chess,color,moves=[]){this.color=color;this.pieces=new Map(chess.board().flat().filter(Boolean).map(p=>[p.square,{...p}]));this.patches=[];for(const m of moves)this.apply(m);}
 get(s){return this.pieces.get(s);}
 destinations(from){return Array.from({length:64},(_,i)=>'abcdefgh'[i%8]+(1+Math.floor(i/8))).filter(to=>this.accepts(from,to));}
 accepts(from,to){
  if(!/^[a-h][1-8]$/.test(from)||!/^[a-h][1-8]$/.test(to))return false;
  const p=this.get(from),target=this.get(to);if(!p||p.color!==this.color||from===to||target?.color===this.color||target?.type==='k')return false;
  const dx=to.charCodeAt(0)-from.charCodeAt(0),dy=Number(to[1])-Number(from[1]),ax=Math.abs(dx),ay=Math.abs(dy);
  if(p.type==='n')return ax*ay===2;
  if(p.type==='k')return Math.max(ax,ay)===1||(dy===0&&ax===2&&from===(this.color==='w'?'e1':'e8')&&this.get((dx>0?'h':'a')+from[1])?.type==='r'&&this.clear(from,(dx>0?'h':'a')+from[1]));
  if(p.type==='p'){const dir=this.color==='w'?1:-1;return (ax===1&&dy===dir)||(dx===0&&!target&&(dy===dir||(dy===2*dir&&from[1]===(this.color==='w'?'2':'7')&&!this.get(from[0]+(Number(from[1])+dir)))));}
  return ((p.type==='b'&&ax===ay)||(p.type==='r'&&(!dx||!dy))||(p.type==='q'&&(!dx||!dy||ax===ay)))&&this.clear(from,to);
 }
 clear(from,to){const dx=Math.sign(to.charCodeAt(0)-from.charCodeAt(0)),dy=Math.sign(Number(to[1])-Number(from[1]));let x=from.charCodeAt(0)+dx,y=Number(from[1])+dy;while(String.fromCharCode(x)+y!==to){if(this.get(String.fromCharCode(x)+y))return false;x+=dx;y+=dy;}return true;}
 apply(m){
  const from=m.slice(0,2),to=m.slice(2,4),p=this.get(from),patch=new Map();
  const put=(s,v)=>{if(!patch.has(s))patch.set(s,this.get(s));if(v)this.pieces.set(s,{...v,square:s});else this.pieces.delete(s);};
  // Retain intentions after an unknown reply makes their projection impossible.
  if(p?.color===this.color){
   if(p.type==='p'&&from[0]!==to[0]&&!this.get(to)){const s=to[0]+from[1];if(this.get(s)?.type==='p'&&this.get(s)?.color!==this.color)put(s,null);}
   if(p.type==='k'&&Math.abs(from.charCodeAt(0)-to.charCodeAt(0))===2){const r=(to[0]==='g'?'h':'a')+from[1],rook=this.get(r);if(rook?.color===this.color){put(r,null);put((to[0]==='g'?'f':'d')+from[1],rook);}}
   put(from,null);put(to,{...p,type:m[4]||p.type});
  }
  this.patches.push(patch);
 }
 undo(){for(const [s,p] of this.patches.pop()||[])if(p)this.pieces.set(s,p);else this.pieces.delete(s);}
}
export function executePremove(game,now=Date.now()){
 if(!game.premoves?.length||game.status!=='active'||game.clock.paused||game.mode==='arena')return 'none';
 const c=chessFor(game);if(c.turn()!==game.player)return 'none';
 const m=game.premoves[0];
 if(!validIntent(m)||!c.moves({square:m.slice(0,2),verbose:true}).some(x=>x.to===m.slice(2,4)&&(x.promotion||'')===(m[4]||''))){game.premoves=[];game.revision++;return 'invalid';}
 const move=play(game,{from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]},now);
 if(!move){game.premoves=[];return 'finished';}
 game.premoves.shift();if(game.status!=='active')game.premoves=[];return 'played';
}
