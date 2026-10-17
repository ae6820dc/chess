import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../vendor/chess.js';
import {newGame,DEFAULTS,chessFor,play} from '../core.js';
import {Plan,executePremove} from '../premoves.js';
const create=(line=[],prefs={})=>newGame({id:'p',balance:'100000'},{...DEFAULTS,...prefs},'analysis',line,1000);
for(const count of [1,10,100,1000])test(`${count} intentions project, undo and serialize without changing actual chess`,()=>{
 const g=create(),fen=chessFor(g).fen(),p=new Plan(chessFor(g),'w');
 for(let i=0;i<count;i++){const m=i%2?'f3g1':'g1f3';assert.ok(p.accepts(m.slice(0,2),m.slice(2)));g.premoves.push(m);p.apply(m);}
 assert.equal(chessFor(g).fen(),fen);assert.equal(JSON.parse(JSON.stringify(g)).premoves.length,count);
 const restored=new Plan(chessFor(g),'w',g.premoves);assert.deepEqual(restored.pieces,p.pieces);
 for(let i=0;i<count;i++)p.undo();assert.equal(p.get('g1').type,'n');assert.equal(p.get('f3'),undefined);
});
test('one response executes at most one intention and charges clocks plus increment',()=>{
 const g=create(['e2e4']);g.premoves=['g1f3','f1c4'];play(g,{from:'e7',to:'e5'},2000);
 assert.equal(executePremove(g,2001),'played');assert.deepEqual(g.premoves,['f1c4']);assert.equal(g.moves.at(-1),'g1f3');assert.equal(g.clock.w,604999);assert.equal(g.clock.b,604000);assert.equal(executePremove(g,2002),'none');
});
for(const [name,line,move] of [
 ['capture',['e2e4','d7d5'],'e4d5'],
 ['castle',['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6'],'e1g1'],
 ['en passant',['e2e4','a7a6','e4e5','d7d5'],'e5d6'],
 ...['q','r','b','n'].map(p=>['promotion '+p,['a2a4','h7h5','a4a5','h5h4','a5a6','h4h3','a6b7','h3g2'],'b7a8'+p]),
 ['checkmate',['e2e4','e7e5','d1h5','b8c6','f1c4','g8f6'],'h5f7']
])test(`execution validates ${name}`,()=>{const g=create(line);g.premoves=[move];assert.equal(executePremove(g,1000),'played');assert.equal(g.moves.at(-1),move);if(name==='checkmate')assert.equal(g.reason,'Checkmate');});
test('illegal check evasion clears dependent queue and leaves position and clocks unchanged',()=>{
 const g=create(['e2e4','e7e5','f2f3','d8h4']);g.premoves=['a2a3','b2b3'];const before=structuredClone(g);assert.equal(executePremove(g,1100),'invalid');assert.deepEqual(g.moves,before.moves);assert.deepEqual(g.clock,before.clock);assert.deepEqual(g.premoves,[]);
});
test('expired player clock cannot be bypassed',()=>{const g=create(['e2e4','e7e5'],{base:1,increment:0});g.premoves=['g1f3'];assert.equal(executePremove(g,2001),'finished');assert.equal(g.moves.length,2);assert.equal(g.reason,'Time expired');});
test('planning allows conditional pawn diagonals without inventing a reply',()=>{const c=new Chess(),p=new Plan(c,'w');assert.ok(p.accepts('e2','d3'));p.apply('e2d3');assert.equal(p.get('d3').type,'p');assert.equal(p.get('d7').type,'p');assert.equal(c.get('e2').type,'p');});
test('ten consecutive replies consume ten intentions in order',()=>{
 const g=create(['e2e4']);g.premoves=Array.from({length:10},(_,i)=>i%2?'f3g1':'g1f3');
 for(const [i,m] of ['a7a6','a6a5','b7b6','b6b5','c7c6','c6c5','d7d6','d6d5','e7e6','e6e5'].entries()){
  play(g,{from:m.slice(0,2),to:m.slice(2)},1000);assert.equal(executePremove(g,1000),'played');assert.equal(g.premoves.length,9-i);
 }
 assert.equal(g.moves.length,21);assert.equal(g.status,'active');
});
test('legal blocking intention can resolve check',()=>{const g=create(['e2e4','e7e5','f2f3','d8h4']);g.premoves=['g2g3'];assert.equal(executePremove(g,1000),'played');assert.equal(chessFor(g).isCheck(),false);});
test('paused and opponent turns never execute or consume intentions',()=>{const g=create(['e2e4']);g.premoves=['g1f3'];assert.equal(executePremove(g,1000),'none');g.clock.paused=true;assert.equal(executePremove(g,1000),'none');assert.deepEqual(g.premoves,['g1f3']);});
test('malformed planning coordinates are rejected without tracing an unbounded path',()=>{const p=new Plan(new Chess(),'w');for(const to of ['zz','d9','','d1','e2e4'])assert.equal(p.accepts('d1',to),false);});
