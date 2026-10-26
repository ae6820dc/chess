import { Chess } from './vendor/chess.js';
import { uci } from './core.js';
export const MAX_DEPTH=3;
export class Enumeration {
 constructor({onProgress=()=>{},maxNodes=250000,maxMilliseconds=15000}={}){this.cache=new Map();this.nodes=0;this.onProgress=onProgress;this.maxNodes=maxNodes;this.deadline=Date.now()+maxMilliseconds;}
 check(){if(++this.nodes>this.maxNodes||Date.now()>this.deadline)throw Error('Exact enumeration exceeded the resource limit. Choose a smaller depth.');if(this.nodes%500===0)this.onProgress({nodes:this.nodes});}
 ordered(chess){return chess.moves({verbose:true}).sort((a,b)=>uci(a).localeCompare(uci(b),'en'));}
 count(chess,depth){this.check();if(depth===0)return 1n;const key=chess.fen().split(' ').slice(0,4).join(' ')+':'+depth;if(this.cache.has(key))return this.cache.get(key);let total=0n;for(const move of this.ordered(chess)){chess.move(move);total+=this.count(chess,depth-1);chess.undo();}if(this.cache.size>20000)this.cache.clear();this.cache.set(key,total);return total;}
 validate(depth){if(!Number.isInteger(depth)||depth<1||depth>MAX_DEPTH)throw Error(`Exact random access is supported only at depths 1–${MAX_DEPTH}`);}
 unrank(depth,rank){this.validate(depth);rank=BigInt(rank);const chess=new Chess(),total=this.count(chess,depth);if(rank<0n||rank>=total)throw Error(`Rank must be between 0 and ${total-1n}`);const moves=[];for(let d=depth;d>0;d--){let found=false;for(const move of this.ordered(chess)){chess.move(move);const n=this.count(chess,d-1);if(rank<n){moves.push(uci(move));found=true;break;}rank-=n;chess.undo();}if(!found)throw Error('Invalid continuation');}return {moves,total:total.toString(),fen:chess.fen(),nodes:this.nodes};}
 rank(moves){this.validate(moves.length);const chess=new Chess();let rank=0n;for(let i=0;i<moves.length;i++){let found=false;for(const move of this.ordered(chess)){chess.move(move);if(uci(move)===moves[i]){found=true;break;}rank+=this.count(chess,moves.length-i-1);chess.undo();}if(!found)throw Error('Not a legal opening sequence');}return rank;}
}
