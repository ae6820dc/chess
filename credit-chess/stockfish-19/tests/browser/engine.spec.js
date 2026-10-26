import { test, expect } from '@playwright/test';
test('real Stockfish WASM starts at a project subpath and returns legal moves', async ({page}) => {
 await page.goto('/credit-chess/stockfish-19/proof.html');
 const result = await page.evaluate(async () => {
  const {StockfishAdapter} = await import('./engine.js');
  const {Chess} = await import('./vendor/chess.js');
  const a = new StockfishAdapter(); const b = new StockfishAdapter();
  try {
   const range = await a.ready; await b.ready;
   const game = new Chess(); const moves=[];
   for(let i=0;i<8;i++) {
    const uci=await (i%2?b:a).move({moves,difficulty:i%2?'MAX':String(range.min),milliseconds:50});
    const m=game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
    if(!m) throw Error('Illegal engine move'); moves.push(uci);
   }
   return {range,moves,fen:game.fen()};
  } finally {a.close();b.close();}
 });
 expect(result.moves).toHaveLength(8); expect(result.range.min).toBeGreaterThan(0);
 console.log('Real engine proof:',JSON.stringify(result));
});
