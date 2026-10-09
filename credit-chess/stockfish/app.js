import {Chess} from './vendor/chess.js';
import {StockfishAdapter} from './engine.js';
import {DEFAULTS,chessFor,newGame,remaining,debit,timeout,play,finish,claimable,pgn,uci} from './core.js';
import {read,mutate,createProfile,authenticate,savePrefs,saveGame,encryptBackup,decryptBackup,importBackup,restoreRecovery} from './storage.js';
const $=id=>document.getElementById(id);
let profile,prefs,game,selected=null,engines=[],generation=0,searching=false,openingWorker,opening=null,openingRequest=0,replayGame,replayPly=0,dragStart=null,canWrite=false;
let storageBlocked=false,storageFailure='';
let queue=Promise.resolve();
const enqueue=(fn,allowBlocked=false)=>{queue=queue.then(()=>{if(storageBlocked&&!allowBlocked)throw Error(storageFailure||'Saving is blocked. Keep this tab open and use Retry failed save.');return fn();}).catch(error=>notice(error.message,true));return queue;};
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function closeEngines(){generation++;searching=false;for(const e of engines)e.close();engines=[];$('engine-status').textContent='Engine idle';}
const names={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
const glyphs={w:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'},b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}};
function boardView(target,chess,orientation='w',interactive=false){
 const files=orientation==='w'?'abcdefgh':'hgfedcba',ranks=orientation==='w'?'87654321':'12345678';
 let destinations=[];
 if(interactive&&selected)destinations=chess.moves({square:selected,verbose:true}).map(m=>m.to);
 target.replaceChildren();
 for(const r of ranks)for(const f of files){
  const square=f+r,p=chess.get(square),el=document.createElement('button');el.type='button';el.className='square'+((f.charCodeAt(0)+Number(r))%2?' dark':'');el.dataset.square=square;
  el.setAttribute('aria-label',`${square}${p?' '+(p.color==='w'?'White ':'Black ')+names[p.type]:' empty'}`);
  if(p){const piece=document.createElement('span');piece.className='piece '+(p.color==='w'?'white':'black');piece.textContent=glyphs[p.color][p.type];el.append(piece);}
  const coord=document.createElement('span');coord.className='coord';coord.textContent=square;el.append(coord);
  if(selected===square&&interactive)el.classList.add('selected');if(destinations.includes(square))el.classList.add('legal');
  if(interactive&&game?.moves.length){const m=game.moves.at(-1);if(m.slice(0,2)===square||m.slice(2,4)===square)el.classList.add('last');}
  if(!interactive)el.tabIndex=-1;target.append(el);
 }
}
function renderClocks(){
 const g=game,clocks=g?remaining(g):{w:(prefs?.base||600)*1000,b:(prefs?.base||600)*1000};
 const bottom=g?.mode==='arena'?'w':(g?.player||prefs?.color||'w'),top=bottom==='w'?'b':'w',side=g?chessFor(g).turn():null;
 for(const [id,color] of [['top-clock',top],['bottom-clock',bottom]]){$(id).textContent=clockText(clocks[color]);$(id).classList.toggle('running',g?.status==='active'&&!g.clock.paused&&color===side);}
 $('top-name').textContent=g?.mode==='arena'?'Stockfish · Black':`Stockfish · ${top==='w'?'White':'Black'}`;
 $('bottom-name').textContent=g?.mode==='arena'?'Stockfish · White':`You · ${bottom==='w'?'White':'Black'}`;
}
function clockText(ms){const s=Math.ceil(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function renderGame(){
 const c=game?chessFor(game):new Chess();boardView($('board'),c,game?.mode==='arena'?'w':(game?.player||prefs?.color||'w'),true);renderClocks();
 $('moves').replaceChildren();for(const san of c.history()){const li=document.createElement('li');li.textContent=san;$('moves').append(li);}$('moves').scrollTop=$('moves').scrollHeight;
 const active=game?.status==='active';
 $('game-status').textContent=!game?'Choose your match and start a game.':active?(game.clock.paused?'Arena paused':`${c.turn()==='w'?'White':'Black'} to move${c.isCheck()?' · Check':''} · ${game.mode==='rated'?'Credits game':game.mode}`):`${game.result} · ${game.reason}${game.mode==='rated'?' · Balance '+profile.balance:''}`;
 $('resign').disabled=!active||game.mode==='arena';$('claim').disabled=!active||game.mode==='arena'||c.turn()!==game.player||!claimable(game);
 $('undo').disabled=!active||game.mode!=='analysis'||game.moves.length<=game.openingPlies;$('arena-pause').hidden=!(active&&game.mode==='arena');$('arena-pause').textContent=game?.clock.paused?'Resume arena':'Pause arena';
 $('from').disabled=$('to').disabled=!active||game.mode==='arena'||c.turn()!==game.player;
}
function tab(name){for(const e of document.querySelectorAll('.tab'))e.hidden=e.id!=='tab-'+name;for(const e of document.querySelectorAll('[data-tab]'))e.classList.toggle('active',e.dataset.tab===name);if(name==='archive')enqueue(renderArchive);}
function applyPrefs(){
 document.body.dataset.theme=prefs.theme;
 for(const id of ['theme','difficulty','color','stake'])$(id).value=prefs[id];$('sound').checked=prefs.sound;
 $('base').value=prefs.base/60;$('increment').value=prefs.increment;const preset=`${prefs.base},${prefs.increment}`;$('preset').value=['600,5','300,3','180,2'].includes(preset)?preset:'custom';
 $('opening-depth').value=prefs.openingDepth;$('opening-rank').value=prefs.openingRank;
 $('multiplier-inputs').replaceChildren();for(const [level,value] of Object.entries(prefs.multipliers)){const label=document.createElement('label');label.textContent=level;const input=document.createElement('input');input.dataset.level=level;input.value=value;input.inputMode='numeric';input.pattern='[0-9]+';input.required=true;label.append(input);$('multiplier-inputs').append(label);}payoutNote();
}
function payoutNote(){$('payout-note').textContent=`Win: +stake × ${prefs?.multipliers[$('difficulty').value]||'2'} · loss: −stake · draw: 0. Terms are locked when the game starts.`;}
async function capturePrefs(){
 const base=Number($('base').value)*60,increment=Number($('increment').value);
 if(!Number.isFinite(base)||base<1||base>86400||!Number.isFinite(increment)||increment<0||increment>3600)throw Error('Choose a base of 1 second–24 hours and an increment of 0–3600 seconds');
 if(!/^\d+$/.test($('stake').value))throw Error('Stake must be a non-negative whole integer');
 Object.assign(prefs,{stake:BigInt($('stake').value).toString(),base,increment,color:$('color').value,difficulty:$('difficulty').value});await savePrefs(profile.id,prefs);payoutNote();
}
async function refreshProfile(){const data=await read();profile=data.profiles.find(p=>p.id===profile.id);if(!profile)throw Error('Profile no longer exists');$('profile-label').textContent=profile.name+' · LOCAL PROFILE';$('balance').textContent=profile.balance;}
async function persist(){
 if(game.status==='finished'&&game.mode==='arena'&&game.arena?.remaining>1)game.arena.pending=true;
 try {game=await saveGame(game);await refreshProfile();storageBlocked=false;storageFailure='';$('retry-save').hidden=true;renderGame();}
 catch(error){storageBlocked=true;closeEngines();$('retry-save').hidden=false;renderGame();storageFailure='Game could not be saved: '+error.message+'. Current state remains in this tab; keep it open and use Retry failed save.';throw Error(storageFailure);}
}
async function abandon(){
 if(game?.status==='active'){
  if(!confirm('End the current game? A credits game records a resignation and loses its stake. Other modes finish without credits.'))return false;
  closeEngines();if(game.mode==='arena')game.arena.remaining=1;
  finish(game,game.mode==='rated'?(game.player==='w'?'0-1':'1-0'):'1/2-1/2',game.mode==='rated'?'Player resigned':'Stopped by user');await persist();
 }
 return true;
}
async function launch(mode,sequence=[],arena=null){
 closeEngines();selected=null;game=newGame(profile,prefs,mode,sequence);if(arena)game.arena=arena;
 await persist();tab('play');scheduleEngine();
}
function scheduleEngine(){
 if(storageBlocked||!game||game.status!=='active'||game.clock.paused||searching)return;
 const c=chessFor(game);if(game.mode!=='arena'&&c.turn()===game.player)return;
 const required=game.mode==='arena'?2:1;
 if(!engines.length){for(let i=0;i<required;i++){const engine=new StockfishAdapter(message=>{$('engine-status').textContent=message;});engine.ready.catch(()=>{});engines.push(engine);}}
 const engine=engines[game.mode==='arena'?(c.turn()==='w'?0:1):0],token=generation,id=game.id;
 searching=true;$('engine-status').textContent='Stockfish thinking…';const left=remaining(game),time=Math.min(game.mode==='arena'?game.arena.speed:600,Math.max(1,left[c.turn()]-20));
 engine.move({moves:[...game.moves],difficulty:game.difficulty,milliseconds:time,clocks:left,increment:Math.floor(game.clock.increment*1000)}).then(move=>enqueue(async()=>{
  if(token!==generation||game?.id!==id||game.status!=='active'||game.clock.paused)return;
  searching=false;
  if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))throw Error('Engine returned no playable move');
  const legal=play(game,{from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});if(legal)sound();await persist();
  if(game.status==='finished')await ended();else scheduleEngine();
 })).catch(error=>enqueue(async()=>{
  if(token!==generation||game?.id!==id)return;closeEngines();
  if(game.mode==='arena'){debit(game);game.clock.paused=true;game.revision++;await persist();}
  notice('Engine error: '+error.message+'. '+(game.mode==='arena'?'Arena paused; resume to retry.':'Clock continues. Reload to retry, or resign.'),true);
 }));
}
async function ended(){closeEngines();notice(`Game saved · ${game.reason}`);if(game.mode==='arena'&&game.arena.pending)await nextArena();}
async function nextArena(){
 const previous=game;if(!previous?.arena?.pending)return;
 const rank=(BigInt(previous.arena.rank)+1n).toString();
 let result;try{result=await generate(previous.arena.depth,rank);}catch(e){previous.arena.pending=false;await mutate(data=>{const stored=data.games.find(g=>g.id===previous.id);stored.arena.pending=false;});notice('Arena series stopped: '+e.message);return;}
 const arena={...previous.arena,remaining:previous.arena.remaining-1,rank,pending:false};
 game=newGame(profile,{...prefs,base:previous.clock.base,increment:previous.clock.increment,difficulty:previous.difficulty},'arena',result.moves);game.arena=arena;game.pgn=pgn(game);
 await mutate(data=>{const stored=data.games.find(g=>g.id===previous.id);if(!stored?.arena?.pending)throw Error('Series already advanced');stored.arena.pending=false;data.games.push(structuredClone(game));});
 prefs.openingRank=rank;await savePrefs(profile.id,prefs);$('opening-rank').value=rank;renderGame();$('arena-status').textContent=`Series running · ${arena.remaining} game(s) remaining · opening #${rank}`;scheduleEngine();
}
function sound(){if(!prefs?.sound)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=480;gain.gain.value=.04;osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.06);osc.onended=()=>ctx.close();}catch{}}
async function promote(){return new Promise(resolve=>{const dialog=$('promotion');const done=value=>{dialog.close();dialog.removeEventListener('click',click);dialog.removeEventListener('cancel',cancel);resolve(value);};const click=e=>{const value=e.target.dataset.promotion;if(value)done(value==='cancel'?null:value);};const cancel=e=>{e.preventDefault();done(null);};dialog.addEventListener('click',click);dialog.addEventListener('cancel',cancel);dialog.showModal();});}
async function humanMove(from,to){
 if(!game||game.status!=='active'||game.mode==='arena'||chessFor(game).turn()!==game.player)return;
 const c=chessFor(game),options=c.moves({square:from,verbose:true}).filter(m=>m.to===to);
 if(!options.length)throw Error('That move is not legal');
 let promotion;if(options.some(m=>m.promotion)){promotion=await promote();if(!promotion)return;}
 const legal=play(game,{from,to,promotion});selected=null;if(legal)sound();await persist();if(game.status==='finished')await ended();else scheduleEngine();
}
function squareClick(square){enqueue(async()=>{
 if(!game||game.status!=='active'||game.mode==='arena'||chessFor(game).turn()!==game.player)return;
 const p=chessFor(game).get(square);
 if(selected&&square!==selected&&p?.color!==game.player){const from=selected;await humanMove(from,square);}else{selected=selected===square?null:(p?.color===game.player?square:null);renderGame();}
});}
$('board').addEventListener('click',e=>{if(suppressClick){suppressClick=false;return;}const square=e.target.closest('[data-square]')?.dataset.square;if(square)squareClick(square);});
let suppressClick=false;
$('board').addEventListener('pointerdown',e=>{dragStart=e.target.closest('[data-square]')?.dataset.square;});
$('board').addEventListener('pointerup',e=>{const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-square]')?.dataset.square;if(dragStart&&target&&dragStart!==target){suppressClick=true;const from=dragStart;enqueue(()=>humanMove(from,target));}dragStart=null;});
$('board').addEventListener('pointercancel',()=>{dragStart=null;});
function generate(depth,rank){
 if(openingWorker)throw Error('An opening computation is already running');
 const request=++openingRequest;return new Promise((resolve,reject)=>{
  const worker=openingWorker=new Worker(new URL('./opening-worker.js',import.meta.url),{type:'module'});
  const timer=setTimeout(()=>finishRequest(Error('Opening computation timed out')),16000);
  function finishRequest(error,result){clearTimeout(timer);worker.terminate();if(request===openingRequest)openingWorker=null;openingReject=null;error?reject(error):resolve(result);}
  openingReject=()=>finishRequest(Error('Opening computation cancelled'));
  worker.onmessage=({data})=>{if(data.progress)$('opening-status').textContent=`Counting legal continuations · ${data.progress.nodes} nodes…`;else if(data.error)finishRequest(Error(data.error));else finishRequest(null,data.result);};
  worker.onerror=e=>finishRequest(Error(e.message));worker.postMessage({depth,rank});
 });
}
let openingReject;
async function loadOpening(rank=$('opening-rank').value){
 const depth=Number($('opening-depth').value);if(!/^\d+$/.test(rank))throw Error('Rank must be a non-negative integer');
 if(game?.status==='active'&&game.mode==='arena'&&!game.clock.paused)throw Error('Pause the arena before computing openings');
 const result=await generate(depth,rank);opening={...result,depth,rank:BigInt(rank).toString()};prefs.openingDepth=depth;prefs.openingRank=opening.rank;await savePrefs(profile.id,prefs);$('opening-rank').value=opening.rank;
 const c=new Chess();for(const m of result.moves)c.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]});
 $('opening-status').textContent=`Sequence #${opening.rank} of ${result.total} · exact BigInt count`;$('opening-line').textContent=c.history().join(' → ')+'\n'+result.moves.join(' ');return opening;
}
async function renderArchive(){
 const data=await read();$('archive-list').replaceChildren();const games=data.games.filter(g=>g.profileId===profile.id).sort((a,b)=>b.created-a.created);
 if(!games.length){$('archive-list').textContent='Your first game will appear here.';return;}
 for(const g of games){const row=document.createElement('div');row.className='archive-item';const info=document.createElement('div');const title=document.createElement('strong');title.textContent=`${g.result} · ${g.reason||'In progress'} · ${g.mode}`;const detail=document.createElement('small');detail.textContent=`${new Date(g.created).toLocaleString()} · ${g.moves.length} plies · stake ${g.stake} × ${g.multiplier} · ${g.difficulty} · ${g.clock.base/60}+${g.clock.increment} · balance ${g.endingBalance??'pending'}`;info.append(title,detail);const actions=document.createElement('div');actions.className='actions';const replay=document.createElement('button');replay.textContent='Replay';replay.onclick=()=>{replayGame=g;replayPly=0;$('replay').hidden=false;renderReplay();$('replay').scrollIntoView({behavior:'smooth'});};const exportBtn=document.createElement('button');exportBtn.textContent='Export PGN';exportBtn.onclick=()=>download(pgn(g),`chess-${g.id}.pgn`,'application/x-chess-pgn');actions.append(replay,exportBtn);row.append(info,actions);$('archive-list').append(row);}
}
function renderReplay(){boardView($('replay-board'),chessFor(replayGame,replayPly));$('replay-title').textContent=`Replay · ${replayGame.result}`;$('replay-status').textContent=`Ply ${replayPly}/${replayGame.moves.length} · ${chessFor(replayGame,replayPly).history().at(-1)||'Starting position'}`;$('replay-prev').disabled=replayPly===0;$('replay-next').disabled=replayPly===replayGame.moves.length;}
function download(text,name,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function unlocked(p){
 profile=p;prefs={...structuredClone(DEFAULTS),...p.prefs};sessionStorage.setItem('chess-profile',p.id);$('auth').hidden=true;$('club').hidden=false;$('logout').hidden=false;applyPrefs();await refreshProfile();
 const data=await read(),games=data.games.filter(g=>g.profileId===p.id).sort((a,b)=>b.created-a.created);game=games.find(g=>g.status==='active')||games.find(g=>g.mode==='arena'&&g.arena?.pending)||games[0]||null;
 renderGame();notice('Profile unlocked · all data stays on this device');
 if(game?.status==='active'){if(timeout(game)){await persist();await ended();}else scheduleEngine();}else if(game?.arena?.pending)await nextArena();
}
async function lockProfile(){closeEngines();if(game?.status==='active'&&game.mode==='arena'){debit(game);game.clock.paused=true;game.revision++;await persist();}profile=null;game=null;sessionStorage.removeItem('chess-profile');$('club').hidden=true;$('logout').hidden=true;await renderAuth();}
async function renderAuth(){const data=await read();$('auth').hidden=false;$('profile-select').replaceChildren();for(const p of data.profiles){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;$('profile-select').append(option);}$('login-form').hidden=!data.profiles.length;notice('Local storage ready. Create or unlock a profile.');}
$('create-form').onsubmit=e=>{e.preventDefault();enqueue(async()=>{if(!canWrite)throw Error('Another tab owns local storage');const p=await createProfile($('profile-name').value,$('create-password').value);$('create-password').value='';await unlocked(p);});};
$('login-form').onsubmit=e=>{e.preventDefault();enqueue(async()=>{const data=await read(),p=data.profiles.find(p=>p.id===$('profile-select').value);await authenticate(p,$('login-password').value);$('login-password').value='';await unlocked(p);});};
$('logout').onclick=()=>enqueue(lockProfile);
$('retry-save').onclick=()=>enqueue(async()=>{storageBlocked=false;ticking=false;timeout(game);await persist();notice('Game saved successfully.');if(game.status==='finished')await ended();else scheduleEngine();},true);
for(const btn of document.querySelectorAll('[data-tab]'))btn.onclick=()=>tab(btn.dataset.tab);
$('new-game-form').onsubmit=e=>{e.preventDefault();enqueue(async()=>{await capturePrefs();if(!await abandon())return;let sequence=[];if($('use-opening').checked)sequence=(await loadOpening()).moves;await launch($('mode').value,sequence);});};
$('move-form').onsubmit=e=>{e.preventDefault();enqueue(()=>humanMove($('from').value.toLowerCase(),$('to').value.toLowerCase()));};
$('resign').onclick=()=>enqueue(async()=>{if(game?.status!=='active'||game.mode==='arena')return;closeEngines();finish(game,game.player==='w'?'0-1':'1-0','Player resigned');await persist();await ended();});
$('claim').onclick=()=>enqueue(async()=>{if(game?.status!=='active'||game.mode==='arena'||chessFor(game).turn()!==game.player||!claimable(game))return;closeEngines();finish(game,'1/2-1/2','Player claimed 50-move rule or threefold repetition');await persist();await ended();});
$('undo').onclick=()=>enqueue(async()=>{if(game?.status!=='active'||game.mode!=='analysis'||game.moves.length<=game.openingPlies)return;if(timeout(game)){await persist();await ended();return;}closeEngines();debit(game);do{game.moves.pop();}while(game.moves.length>game.openingPlies&&chessFor(game).turn()!==game.player);game.clock.since=Date.now();game.revision++;selected=null;await persist();scheduleEngine();});
$('preset').onchange=()=>enqueue(async()=>{if($('preset').value!=='custom'){const [base,increment]=$('preset').value.split(',').map(Number);$('base').value=base/60;$('increment').value=increment;}await capturePrefs();if(!game)renderClocks();});
for(const id of ['difficulty','color','stake','base','increment'])$(id).onchange=()=>enqueue(async()=>{await capturePrefs();if(!game)renderGame();});
$('theme').onchange=()=>enqueue(async()=>{prefs.theme=$('theme').value;document.body.dataset.theme=prefs.theme;await savePrefs(profile.id,prefs);});$('sound').onchange=()=>enqueue(async()=>{prefs.sound=$('sound').checked;await savePrefs(profile.id,prefs);});
$('multiplier-form').onsubmit=e=>{e.preventDefault();enqueue(async()=>{const multipliers={};for(const input of document.querySelectorAll('[data-level]')){if(!/^\d+$/.test(input.value))throw Error('Multipliers must be whole non-negative integers');multipliers[input.dataset.level]=BigInt(input.value).toString();}prefs.multipliers=multipliers;await savePrefs(profile.id,prefs);payoutNote();notice('Multipliers saved. Existing game terms stay locked.');});};
$('opening-jump').onclick=()=>enqueue(()=>loadOpening());$('opening-prev').onclick=()=>enqueue(()=>loadOpening((BigInt($('opening-rank').value)-1n).toString()));$('opening-next').onclick=()=>enqueue(()=>loadOpening((BigInt($('opening-rank').value)+1n).toString()));$('opening-cancel').onclick=()=>openingReject?.();$('opening-play').onclick=()=>{tab('play');$('use-opening').checked=true;};
$('arena-form').onsubmit=e=>{e.preventDefault();enqueue(async()=>{await capturePrefs();if(!await abandon())return;const count=Number($('arena-count').value),speed=Number($('arena-speed').value);if(!Number.isInteger(count)||count<1||count>100||!Number.isInteger(speed)||speed<20||speed>2000)throw Error('Arena limits: 1–100 games, 20–2000 ms think time');const result=await loadOpening();await launch('arena',result.moves,{remaining:count,speed,depth:result.depth,rank:result.rank,pending:false});$('arena-status').textContent=`Series running · ${count} game(s) remaining`;});};
$('arena-pause').onclick=()=>enqueue(async()=>{if(game?.status!=='active'||game.mode!=='arena')return;closeEngines();if(timeout(game)){await persist();await ended();return;}debit(game);game.clock.paused=!game.clock.paused;game.clock.since=Date.now();game.revision++;await persist();scheduleEngine();});
$('replay-prev').onclick=()=>{if(replayPly>0){replayPly--;renderReplay();}};$('replay-next').onclick=()=>{if(replayPly<replayGame.moves.length){replayPly++;renderReplay();}};$('replay-close').onclick=()=>{$('replay').hidden=true;};
$('export-json').onclick=()=>enqueue(async()=>{download(JSON.stringify(await read(),null,2),'stockfish-credit-chess-backup.json');notice('Backup exported. It contains sensitive local profiles and password hashes.');});
$('export-encrypted').onclick=()=>enqueue(async()=>{const data=await encryptBackup(await read(),$('backup-password').value);download(JSON.stringify(data),'stockfish-credit-chess-encrypted.json');$('backup-password').value='';notice('Encrypted backup exported. Keep its password safe.');});
$('import-file').onchange=()=>enqueue(async()=>{
 if(game?.status==='active')throw Error('Finish the current game before importing a backup');
 const file=$('import-file').files[0];if(!file)return;if(file.size>20*1024*1024)throw Error('Backup exceeds 20 MB');let input=JSON.parse(await file.text());if(input.encrypted)input=await decryptBackup(input,$('backup-password').value);const result=await importBackup(input);$('backup-password').value='';$('import-file').value='';notice(`Imported ${result.addedProfiles} profiles and ${result.addedGames} games; kept ${result.conflicts} conflicting records. A pre-import recovery copy is available.`);
});
$('recover').onclick=()=>enqueue(async()=>{if(game?.status==='active')throw Error('Finish the current game before recovery');if(!confirm('Restore the pre-import snapshot? The current data will become the new recovery copy.'))return;await restoreRecovery();await lockProfile();notice('Pre-import data restored. Unlock a profile to continue.');});
let ticking=false;
setInterval(()=>{if(!profile||!game)return;renderClocks();if(storageBlocked)return;if(!ticking&&game.status==='active'&&!game.clock.paused&&remaining(game)[chessFor(game).turn()]<=0){ticking=true;enqueue(async()=>{try{if(timeout(game)){closeEngines();await persist();await ended();}}finally{ticking=false;}});}},200);
window.addEventListener('pagehide',()=>closeEngines());
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
async function init(){
 await read();
 if(!navigator.locks)throw Error('This browser lacks Web Locks. Use an up-to-date mobile browser to protect local credit writes.');
 navigator.locks.request('stockfish-credit-chess-writer',{ifAvailable:true},async lock=>{
  if(!lock){notice('Another chess tab is open. Close it and reload this page to protect clocks and credits.',true);return;}
  canWrite=true;
  try {const data=await read(),session=sessionStorage.getItem('chess-profile'),p=data.profiles.find(x=>x.id===session);if(p)await unlocked(p);else await renderAuth();
   if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').then(async reg=>{await navigator.serviceWorker.ready;$('storage-status').textContent='Offline cache ready. IndexedDB stores profiles and games.';}).catch(e=>{$('storage-status').textContent='Offline caching unavailable: '+e.message;});
   if(navigator.storage?.persist){navigator.storage.persist().then(granted=>{if(!granted)$('storage-status').textContent+=' Browser storage may be evicted; export regular backups.';});}
  }catch(e){notice('Local storage/application error: '+e.message+'. Reload to retry. Do not clear browser data without a backup.',true);}
  await new Promise(()=>{});
 }).catch(e=>notice('Cannot acquire local storage lock: '+e.message,true));
}
init().catch(e=>notice('Local storage unavailable: '+e.message+'. Check browser storage permissions and reload.',true));
