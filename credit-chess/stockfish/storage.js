import {validIntent} from './premoves.js';
import { chessFor, integer, payout, pgn, DEFAULTS } from './core.js';
export const SCHEMA=1;
export const empty=()=>({schemaVersion:SCHEMA,profiles:[],games:[],lastProfile:null});
// Fixed application identifiers; never generate these at launch.
export const PROGRAM_ID='47f4d94492933a3b0a3f406e6e4ce412';
export const STORAGE_KEY='bbebe43a0b38a335';
export const LEGACY_STORAGE_KEY='stockfish-credit-chess';
let db,opening;
function connect(name,target=false){
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(name,1);let failed=false;
  r.onupgradeneeded=()=>{r.result.createObjectStore('data');if(target)r.result.createObjectStore('metadata');};
  r.onsuccess=()=>{if(failed)r.result.close();else resolve(r.result);};
  r.onerror=()=>reject(r.error);
  r.onblocked=()=>{failed=true;reject(Error('Storage upgrade blocked. Close other chess tabs.'));};
 });
}
function records(d){
 return new Promise((resolve,reject)=>{
  const t=d.transaction('data'),s=t.objectStore('data'),rows=[];
  const r=s.openCursor();r.onsuccess=()=>{const c=r.result;if(c){rows.push([c.key,c.value]);c.continue();}};
  t.oncomplete=()=>resolve(rows);t.onerror=t.onabort=()=>reject(t.error||Error('Cannot read legacy storage'));
 });
}
async function migrate(target){
 // Read without altering the legacy store. Copy every record, including recovery
 // backups and future extension records. The marker commits with the data.
 const legacy=await connect(LEGACY_STORAGE_KEY);
 let rows;
 try{rows=await records(legacy);}finally{legacy.close();}
 return new Promise((resolve,reject)=>{
  const t=target.transaction(['data','metadata'],'readwrite'),data=t.objectStore('data'),meta=t.objectStore('metadata');
  let failure;
  const r=meta.get('legacy-migration');
  r.onsuccess=()=>{
   if(r.result===1)return;
   const count=data.count();count.onsuccess=()=>{
    try{
     if(count.result)throw Error('Unmarked destination contains data; refusing to overwrite it');
     if(rows.length&&!rows.some(([key])=>key==='snapshot'))throw Error('Legacy snapshot is missing');
     for(const [key,value] of rows){if(key==='snapshot'||key==='recovery')validateBackup(value);}
     for(const [key,value] of rows)data.add(value,key);
     meta.add(1,'legacy-migration');
    }catch(e){failure=e;t.abort();}
   };
  };
  t.oncomplete=()=>resolve();
  t.onerror=t.onabort=()=>reject(failure||t.error||Error('Migration transaction aborted'));
 });
}
export async function openStorage(){
 if(db)return db;
 if(!opening)opening=(async()=>{
  let target;
  try{
   target=await connect(STORAGE_KEY,true);
   // A completed migration must not depend on the old database remaining readable.
   const done=await new Promise((resolve,reject)=>{
    const t=target.transaction('metadata'),r=t.objectStore('metadata').get('legacy-migration');
    r.onsuccess=()=>resolve(r.result===1);r.onerror=()=>reject(r.error);
   });
   if(!done)await migrate(target);
   db=target;db.onversionchange=()=>{target.close();db=null;};return db;
  }catch(e){target?.close();throw Error('Storage migration/open failed: '+e.message+'; existing data was retained');}
 })().finally(()=>{opening=null;});
 return opening;
}
export async function read(key='snapshot') {
 const d=await openStorage();return new Promise((resolve,reject)=>{const t=d.transaction('data'),r=t.objectStore('data').get(key);r.onsuccess=()=>resolve(r.result || (key==='snapshot'?empty():null));r.onerror=()=>reject(r.error);});
}
export async function mutate(fn) {
 const d=await openStorage();return new Promise((resolve,reject)=>{
  const t=d.transaction('data','readwrite'),s=t.objectStore('data'),r=s.get('snapshot');let result;
  r.onsuccess=()=>{try { const data=r.result||empty();result=fn(data,s);s.put(data,'snapshot'); }catch(e){t.abort();reject(e);}};
  t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error || Error('IndexedDB write failed'));t.onabort=()=>reject(t.error || Error('Storage transaction aborted'));
 });
}
export async function saveGame(game) {
 const snapshot=structuredClone(game);snapshot.pgn=pgn(snapshot);
 return mutate(data=>{
  const profile=data.profiles.find(p=>p.id===snapshot.profileId);if(!profile)throw Error('Profile missing');
  const i=data.games.findIndex(g=>g.id===snapshot.id),existing=data.games[i];
  if(existing && (existing.settled || existing.revision>snapshot.revision)) return existing;
  if(snapshot.status==='finished'&&!snapshot.settled){profile.balance=(BigInt(profile.balance)+payout(snapshot)).toString();snapshot.settled=true;snapshot.endingBalance=profile.balance;}
  if(i<0)data.games.push(snapshot);else data.games[i]=snapshot;return snapshot;
 });
}
export async function savePrefs(id,prefs){return mutate(data=>{const p=data.profiles.find(p=>p.id===id);if(!p)throw Error('Profile missing');p.prefs=structuredClone(prefs);});}
export const bytesToBase64=bytes=>{let str='';for(const b of bytes)str+=String.fromCharCode(b);return btoa(str);};
export const fromBase64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function derive(password,salt,usage) {
 const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits','deriveKey']);
 const spec={name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'};
 return usage?crypto.subtle.deriveKey(spec,base,{name:'AES-GCM',length:256},false,usage):new Uint8Array(await crypto.subtle.deriveBits(spec,base,256));
}
export const isGenerated=p=>p?.kind==='generated'&&/^[0-9A-F]{8}$/.test(p.name)&&!p.auth;
export async function createProfile(pin) {
 if(pin!=='1111')throw Error('Incorrect creation PIN');
 return mutate(data=>{
  if(data.profiles.length>=1000)throw Error('Profile limit reached');
  let name;
  do{name=Array.from(crypto.getRandomValues(new Uint8Array(4)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();}while(data.profiles.some(p=>p.name===name));
  const profile={id:crypto.randomUUID(),kind:'generated',name,balance:'100000',prefs:structuredClone(DEFAULTS),created:Date.now()};
  data.profiles.push(profile);data.lastProfile=profile.id;return profile;
 });
}
export async function selectProfile(id){return mutate(data=>{const p=data.profiles.find(p=>p.id===id&&isGenerated(p));if(!p)throw Error('Generated profile missing');data.lastProfile=id;return p;});}
export function validateBackup(data){
 if(!data||data.schemaVersion!==SCHEMA||!Array.isArray(data.profiles)||!Array.isArray(data.games)||data.profiles.length>1000||data.games.length>10000)throw Error('Unsupported or invalid backup schema');
 const names=new Set(),ids=new Set(),gids=new Set(),activeProfiles=new Set();
 for(const p of data.profiles){
  if(typeof p.id!=='string'||ids.has(p.id)||typeof p.name!=='string'||p.name.length>60||!p.name.trim())throw Error('Invalid profile');ids.add(p.id);
  integer(p.balance,'Balance',true);
  if(p.kind==='generated'){if(!isGenerated(p)||names.has(p.name))throw Error('Invalid generated username');names.add(p.name);}else if(p.auth?.iterations!==310000||fromBase64(p.auth.salt).length!==16||fromBase64(p.auth.hash).length!==32)throw Error('Invalid password record');
  const f=p.prefs;if(!f||!['wood','gold','green','midnight'].includes(f.theme)||!Number.isFinite(f.base)||f.base<1||f.base>86400||!Number.isFinite(f.increment)||f.increment<0||f.increment>3600||!['w','b'].includes(f.color)||typeof f.sound!=='boolean'||!['1320','2000','2800','3190','MAX'].includes(f.difficulty)||!Number.isInteger(f.openingDepth)||f.openingDepth<1||f.openingDepth>3)throw Error('Invalid preferences');
  if(f.responseDelay!==undefined&&(!Number.isFinite(f.responseDelay)||f.responseDelay<0||f.responseDelay>300))throw Error('Invalid response delay');
  if(f.animationDuration!==undefined&&![0,250,400,600,800,1000].includes(f.animationDuration))throw Error('Invalid animation duration');
  integer(f.openingRank,'Opening cursor');integer(f.stake,'Stake');for(const level of Object.keys(DEFAULTS.multipliers))integer(f.multipliers?.[level],'Multiplier');
 }
 for(const g of data.games){
  if(typeof g.id!=='string'||gids.has(g.id)||!ids.has(g.profileId)||!['rated','analysis','arena'].includes(g.mode)||!['active','finished'].includes(g.status)||!['*','1-0','0-1','1/2-1/2'].includes(g.result)||!['w','b'].includes(g.player)||!['1320','2000','2800','3190','MAX'].includes(g.difficulty)||typeof g.reason!=='string')throw Error('Invalid game');gids.add(g.id);
  if(g.premoves!==undefined&&(!Array.isArray(g.premoves)||!g.premoves.every(validIntent)))throw Error('Invalid premove queue');
  integer(g.stake,'Stake');integer(g.multiplier,'Multiplier');integer(g.startingBalance,'Starting balance',true);if(g.endingBalance!==null)integer(g.endingBalance,'Ending balance',true);
  if(!Array.isArray(g.moves)||g.moves.length>10000||g.moves.some(m=>typeof m!=='string'||! /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m))||!Number.isInteger(g.openingPlies)||g.openingPlies<0||g.openingPlies>g.moves.length)throw Error('Invalid moves');chessFor(g);
  if(!g.clock||typeof g.clock.paused!=='boolean'||!Number.isFinite(g.clock.base)||g.clock.base<1||g.clock.base>86400||!Number.isFinite(g.clock.increment)||g.clock.increment<0||g.clock.increment>3600||['w','b','since'].some(k=>!Number.isFinite(g.clock[k])||g.clock[k]<0)||!Number.isInteger(g.revision)||g.revision<0||![g.created,g.updated].every(Number.isFinite)||typeof g.settled!=='boolean')throw Error('Invalid clock or timestamps');
  if(g.status==='active'&&(g.result!=='*'||g.settled||g.finished!==null||activeProfiles.has(g.profileId)))throw Error('Invalid or duplicate active game');
  if(g.status==='active')activeProfiles.add(g.profileId);
  if(g.mode==='arena'){const a=g.arena;if(!a||!Number.isInteger(a.remaining)||a.remaining<1||a.remaining>100||!Number.isInteger(a.speed)||a.speed<20||a.speed>2000||!Number.isInteger(a.depth)||a.depth<1||a.depth>3||typeof a.pending!=='boolean')throw Error('Invalid arena series');integer(a.rank,'Arena cursor');if(BigInt(a.rank)>=[0n,20n,400n,8902n][a.depth])throw Error('Invalid arena rank');}
  if(g.status==='finished'&&(g.result==='*'||!g.settled||!Number.isFinite(g.finished)||g.endingBalance===null))throw Error('Invalid finished game');
 }
 return data;
}
export async function importBackup(input){
 const incoming=validateBackup(structuredClone(input));
 return mutate((data,store)=>{
  store.put(structuredClone(data),'recovery');let addedProfiles=0,addedGames=0,conflicts=0;
  const accepted=new Set();
  for(const p of incoming.profiles){if(data.profiles.some(x=>x.id===p.id||(isGenerated(p)&&x.name===p.name))){conflicts++;continue;}if(data.profiles.some(x=>x.name===p.name))p.name=p.name.slice(0,40)+' (imported '+p.id.slice(0,6)+')';data.profiles.push(structuredClone(p));accepted.add(p.id);addedProfiles++;}
  for(const g of incoming.games){if(!accepted.has(g.profileId)||data.games.some(x=>x.id===g.id)){conflicts++;continue;}data.games.push(structuredClone(g));addedGames++;}
  return {addedProfiles,addedGames,conflicts};
 });
}
export async function restoreRecovery(){const recovery=await read('recovery');if(!recovery)throw Error('No pre-import recovery copy');validateBackup(recovery);return mutate((data,s)=>{s.put(structuredClone(data),'recovery');Object.assign(data,recovery);});}
export async function encryptBackup(data,password){if(password.length<8)throw Error('Backup password must have at least 8 characters');const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await derive(password,salt,['encrypt']);const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(data)));return {encrypted:true,schemaVersion:1,salt:bytesToBase64(salt),iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(bytes))};}
export async function decryptBackup(data,password){if(data.schemaVersion!==1||fromBase64(data.salt).length!==16||fromBase64(data.iv).length!==12)throw Error('Invalid encrypted backup');const key=await derive(password,fromBase64(data.salt),['decrypt']);try{return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(data.iv)},key,fromBase64(data.ciphertext))));}catch{throw Error('Wrong password or damaged encrypted backup');}}
