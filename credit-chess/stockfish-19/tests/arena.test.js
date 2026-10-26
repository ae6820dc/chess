import test from 'node:test';
import assert from 'node:assert/strict';
import {arenaCount,MAX_ARENA_GAMES} from '../arena.js';
import {DEFAULTS,newGame} from '../core.js';
import {validateBackup} from '../storage.js';
const profile={id:'p',kind:'generated',name:'1234ABCD',balance:'100000',prefs:structuredClone(DEFAULTS)};
for(const count of [1,100,101,8902,100000,1000000])test(`arena accepts and serializes ${count} games`,()=>{
 assert.equal(arenaCount(String(count)),count);
 const g=newGame(profile,profile.prefs,'arena');g.arena={remaining:count,speed:200,depth:3,rank:'8901',pending:false};
 const backup={schemaVersion:1,profiles:[profile],games:[g],lastProfile:profile.id};
 assert.equal(validateBackup(JSON.parse(JSON.stringify(backup))).games[0].arena.remaining,count);
 assert.equal(count-1,Number(BigInt(count)-1n));
});
for(const count of ['',0,-1,1.5,1000001,Infinity,NaN,Number.MAX_SAFE_INTEGER+1])test(`reject invalid count ${count}`,()=>{
 assert.throws(()=>arenaCount(count));
 const g=newGame(profile,profile.prefs,'arena');g.arena={remaining:count,speed:200,depth:3,rank:'0',pending:false};
 assert.throws(()=>validateBackup({schemaVersion:1,profiles:[profile],games:[g]}));
});
test('series capacity is independent of atlas size',()=>assert.equal(MAX_ARENA_GAMES,1000000));
