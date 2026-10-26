// Counts stay exact within Number's safe integer range; opening ranks use BigInt.
export const MAX_ARENA_GAMES=1_000_000;
export const validArenaCount=count=>Number.isSafeInteger(count)&&count>=1&&count<=MAX_ARENA_GAMES;
export function arenaCount(value){
 const count=Number(value);
 if(!validArenaCount(count))throw Error('Arena limits: 1–1,000,000 whole games');
 return count;
}
