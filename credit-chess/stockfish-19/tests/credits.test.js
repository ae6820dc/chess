import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatCredits} from '../credits.js';
test('credit formatting preserves exact signed integer strings',()=>{
 for(const [raw,display] of [['0','0'],['99800','99.800'],['1000000','1.000.000'],['123456789','123.456.789'],['1000000000','1.000.000.000'],['-1234567','-1.234.567'],['123456789012345678901234567890','123.456.789.012.345.678.901.234.567.890']])assert.equal(formatCredits(raw),display);
});
