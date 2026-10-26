import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordArena} from '../storage.js';
test('series scores count completed games once and exclude interrupted games',()=>{
 const d={},g={id:'a',profileId:'p',created:1,updated:2,mode:'arena',difficulty:'2000',clock:{base:60,increment:0},status:'finished',result:'1-0',arena:{seriesId:'series',remaining:3,pending:true}};
 recordArena(d,g,null);recordArena(d,g,g);
 recordArena(d,{...g,id:'b',result:'1/2-1/2'},null);
 recordArena(d,{...g,id:'c',result:'*',arena:{...g.arena,pending:false,stopped:true}},null);
 assert.deepEqual([d.arenaSeries[0].completed,d.arenaSeries[0].whitePoints,d.arenaSeries[0].blackPoints,d.arenaSeries[0].status],[2,1.5,.5,'stopped']);
 recordArena(d,{...g,id:'new',arena:{...g.arena,seriesId:'new'}},null);assert.equal(d.arenaSeries.length,2);assert.equal(d.arenaSeries[0].completed,2);
});
