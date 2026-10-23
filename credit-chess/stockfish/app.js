import {formatCredits} from './credits.js';
import {arenaCount} from './arena.js';
import {Plan,executePremove} from './premoves.js';
import {prepareTransition,animateTransition,movementDuration,cancelTransitions} from './animation.js';
import {setUnlocked,showGame} from './layout.js';
import {Chess} from './vendor/chess.js';
import {StockfishAdapter} from './engine.js';
import {DEFAULTS,chessFor,newGame,remaining,debit,timeout,play,finish,claimable,pgn,uci} from './core.js';
import {read,readBackup,ensureArenaHistory,stopArena,recordArena,archivePage,mutate,createProfile,isGenerated,selectProfile,savePrefs,saveGame,encryptBackup,decryptBackup,importBackup,restoreRecovery} from './storage.js';
const $=id=>document.getElementById(id);
let profile,prefs,game,selected=null,engines=[],generation=0,searching=false,openingWorker,opening=null,openingRequest=0,replayGame,replayPly=0,canWrite=false;
let delayedMove=null,stoppingArena=false;
let humanMoving=false,dropOrigin=null,plan=null,planKey='',showPlan=true,instant=false;
function planning(){return game?.status==='active'&&game.mode!=='arena'&&(chessFor(game).turn()!==game.player||!!game.premoves?.length);}
function planningPosition(){
 const key=game.id+':'+game.moves.length+':'+game.player;
 if(!plan||planKey!==key){plan=new Plan(chessFor(game),game.player,game.premoves||[]);planKey=key;}
 return plan;
}
function inputPosition(){return planning()?planningPosition():chessFor(game);}
function inputDestinations(c,from){return c instanceof Plan?c.destinations(from):c.moves({square:from,verbose:true}).map(m=>m.to);}
function renderQueue(){
 const moves=game?.premoves||[],list=$('premove-list');
 $('premove-count').textContent=String(moves.length);
 $('premove-clear').disabled=$('premove-undo').disabled=!moves.length||storageBlocked;
 $('premove-view').textContent=showPlan?'Show actual position':'Show planned position';
 $('position-label').textContent=planning()&&showPlan?'PLANNED':'ACTUAL';
 const start=Math.max(0,Math.min(moves.length-1,Math.floor(list.scrollTop/28)-3)),end=Math.min(moves.length,start+18);
 list.replaceChildren();const spacer=h=>{const el=document.createElement('div');el.style.height=h+'px';list.append(el);};spacer(start*28);
 for(let i=start;i<end;i++){const el=document.createElement('div');el.className='premove-row';el.setAttribute('role','listitem');el.setAttribute('aria-posinset',i+1);el.setAttribute('aria-setsize',moves.length);el.textContent=`${i+1}. ${moves[i].slice(0,2)} → ${moves[i].slice(2,4)}${moves[i][4]?' = '+moves[i][4].toUpperCase():''} · conditional`;list.append(el);}spacer((moves.length-end)*28);
}

let storageBlocked=false,storageFailure='';
let queue=Promise.resolve();
const enqueue=(fn,allowBlocked=false)=>{queue=queue.then(()=>{if(storageBlocked&&!allowBlocked)throw Error(storageFailure||'Saving is blocked. Keep this tab open and use Retry failed save.');return fn();}).catch(error=>notice(error.message,true));return queue;};
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function closeEngines(){delayedMove?.();delayedMove=null;generation++;searching=false;for(const e of engines)e.close();engines=[];$('engine-status').textContent='Engine idle';}
const names={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
const glyphs={w:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'},b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}};
export function boardView(target,chess,orientation='w',interactive=false){
 if(target===$('board'))cancelDrag();
 const files=orientation==='w'?'abcdefgh':'hgfedcba',ranks=orientation==='w'?'87654321':'12345678';
 let destinations=[];
 if(interactive&&selected)destinations=inputDestinations(chess,selected);
 const paths=prepareTransition(target,chess instanceof Plan?chessFor(game):chess,orientation);
 const transition=chess instanceof Plan||instant?[]:paths;
 if(target===$('board')&&dropOrigin){
  const path=transition.find(path=>path.to===dropOrigin.to);if(path)path.rect=dropOrigin.rect;
  dropOrigin=null;
 }
 target.replaceChildren();
 for(const r of ranks)for(const f of files){
  const square=f+r,p=chess.get(square),el=document.createElement('button');el.type='button';el.className='square'+((f.charCodeAt(0)+Number(r))%2===0?' dark':'');el.dataset.square=square;
  el.setAttribute('aria-label',`${square}${p?' '+(p.color==='w'?'White ':'Black ')+names[p.type]:' empty'}`);
  if(p){const piece=document.createElement('span');piece.className='piece '+(p.color==='w'?'white':'black');piece.textContent=glyphs[p.color][p.type];el.append(piece);}
  const coord=document.createElement('span');coord.className='coord';coord.textContent=square;el.append(coord);
  if(selected===square&&interactive)el.classList.add('selected');if(destinations.includes(square))el.classList.add('legal');
  if(interactive&&game?.moves.length){const m=game.moves.at(-1);if(m.slice(0,2)===square||m.slice(2,4)===square)el.classList.add('last');}
  if(!interactive)el.tabIndex=-1;target.append(el);
 }
 animateTransition(target,transition,instant?0:prefs?.animationDuration);
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
 const c=game?chessFor(game):new Chess();boardView($('board'),planning()&&showPlan&&(selected||game.premoves?.length)?planningPosition():c,game?.mode==='arena'?'w':(game?.player||prefs?.color||'w'),true);renderClocks();renderQueue();
 $('moves').replaceChildren();for(const san of c.history()){const li=document.createElement('li');li.textContent=san;$('moves').append(li);}$('moves').scrollTop=$('moves').scrollHeight;
 const active=game?.status==='active';
 $('game-status').textContent=!game?'Choose your match and start a game.':active?(game.clock.paused?'Arena paused':`${c.turn()==='w'?'White':'Black'} to move${c.isCheck()?' · Check':''} · ${game.mode==='rated'?'Credits game':game.mode}`):`${game.result} · ${game.reason}${game.mode==='rated'?' · Balance '+formatCredits(profile.balance):''}`;
 $('resign').disabled=!active||game.mode==='arena';$('claim').disabled=!active||game.mode==='arena'||c.turn()!==game.player||!claimable(game);
 $('undo').disabled=!active||game.mode!=='analysis'||game.moves.length<=game.openingPlies;$('arena-pause').hidden=!(active&&game.mode==='arena');$('arena-stop').hidden=!(game?.mode==='arena'&&!game.arena?.stopped&&(active||game.arena?.pending));$('arena-pause').textContent=game?.clock.paused?'Resume arena':'Pause arena';
 $('from').disabled=$('to').disabled=!active||game.mode==='arena'||c.turn()!==game.player;
}
function tab(name){cancelTransitions();for(const e of document.querySelectorAll('.tab'))e.hidden=e.id!=='tab-'+name;for(const e of document.querySelectorAll('[data-tab]'))e.classList.toggle('active',e.dataset.tab===name);if(name==='archive')enqueue(()=>renderArchive());if(name==='arena')enqueue(renderArenaHistory);}
function applyPrefs(){
 document.body.dataset.theme=prefs.theme;
 const delay=prefs.responseDelay??0;
 $('response-delay').value=[0,1,2,5,10,20,30,60].includes(delay)?String(delay):'custom';
 $('response-delay-custom').value=delay;$('response-delay-custom').hidden=$('response-delay').value!=='custom';
 $('animation-duration').value=movementDuration(prefs.animationDuration,false);
 for(const id of ['theme','difficulty','color'])$(id).value=prefs[id];$('stake').value=formatCredits(prefs.stake);$('sound').checked=prefs.sound;
 $('base').value=prefs.base/60;$('increment').value=prefs.increment;const preset=`${prefs.base},${prefs.increment}`;$('preset').value=['600,5','300,3','180,2'].includes(preset)?preset:'custom';
 $('opening-depth').value=prefs.openingDepth;$('opening-rank').value=prefs.openingRank;
 $('multiplier-inputs').replaceChildren();for(const [level,value] of Object.entries(prefs.multipliers)){const label=document.createElement('label');label.textContent=level;const input=document.createElement('input');input.dataset.level=level;input.value=value;input.inputMode='numeric';input.pattern='[0-9]+';input.required=true;label.append(input);$('multiplier-inputs').append(label);}payoutNote();
}
function payoutNote(){$('payout-note').textContent=`Win: +stake × ${prefs?.multipliers[$('difficulty').value]||'2'} · loss: −stake · draw: 0. Terms are locked when the game starts.`;}
async function capturePrefs(){
 if(!profile)throw Error('Create or select a profile in Settings first');
 const base=Number($('base').value)*60,increment=Number($('increment').value);
 if(!Number.isFinite(base)||base<1||base>86400||!Number.isFinite(increment)||increment<0||increment>3600)throw Error('Choose a base of 1 second–24 hours and an increment of 0–3600 seconds');
 const stake=$('stake').value;
 if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(stake))throw Error('Stake must be a non-negative whole integer');
 Object.assign(prefs,{stake:BigInt(stake.replaceAll('.','')).toString(),base,increment,color:$('color').value,difficulty:$('difficulty').value});await savePrefs(profile.id,prefs);payoutNote();
}
async function refreshProfile(){const data=await read();profile=data.profiles.find(p=>p.id===profile.id);if(!profile)throw Error('Profile no longer exists');$('profile-label').textContent=profile.name+' · LOCAL PROFILE';$('balance').textContent=formatCredits(profile.balance);}
async function persist(){
 if(game.status==='finished'&&game.mode==='arena'&&!game.arena.stopped&&game.arena?.remaining>1)game.arena.pending=true;
 try {game=await saveGame(game);await refreshProfile();storageBlocked=false;storageFailure='';$('retry-save').hidden=true;renderGame();}
 catch(error){storageBlocked=true;closeEngines();$('retry-save').hidden=false;renderGame();storageFailure='Game could not be saved: '+error.message+'. Current state remains in this tab; keep it open and use Retry failed save.';throw Error(storageFailure);}
}
async function abandon(){
 if(game?.status==='active'){
  if(!confirm('End the current game? A credits game records a resignation and loses its stake. Other modes finish without credits.'))return false;
  if(game.mode==='arena'){await stopSeries();return true;}closeEngines();
  finish(game,game.mode==='rated'?(game.player==='w'?'0-1':'1-0'):'1/2-1/2',game.mode==='rated'?'Player resigned':'Stopped by user');await persist();
 }
 return true;
}
async function launch(mode,sequence=[],arena=null){
 closeEngines();selected=null;plan=null;showPlan=true;game=newGame(profile,prefs,mode,sequence);if(arena)game.arena={...arena,seriesId:arena.seriesId||game.id,config:structuredClone(prefs)};
 await persist();tab('play');showGame();scheduleEngine();
}
function scheduleEngine(){
 if(stoppingArena||storageBlocked||!game||game.status!=='active'||game.clock.paused||searching)return;
 const c=chessFor(game);if(game.mode!=='arena'&&c.turn()===game.player)return;
 const required=game.mode==='arena'?2:1;
 if(!engines.length){for(let i=0;i<required;i++){const engine=new StockfishAdapter(message=>{$('engine-status').textContent=message;});engine.ready.catch(()=>{});engines.push(engine);}}
 const engine=engines[game.mode==='arena'?(c.turn()==='w'?0:1):0],token=generation,id=game.id,position=game.moves.join(' '),deadline=game.clock.since+(prefs.responseDelay??0)*1000;
 const current=()=>token===generation&&game?.id===id&&game.status==='active'&&!game.clock.paused&&game.moves.join(' ')===position;
 searching=true;$('engine-status').textContent='Stockfish thinking…';const left=remaining(game),time=Math.min(game.mode==='arena'?game.arena.speed:600,Math.max(1,left[c.turn()]-20));
 engine.move({moves:[...game.moves],difficulty:game.difficulty,milliseconds:time,clocks:left,increment:Math.floor(game.clock.increment*1000)}).then(async move=>{
  if(!current())return;
  // Every engine turn uses the previous move timestamp, for either color and mode.
  // Search/loading/save time counts toward the delay; slow searches add no extra wait.
  const wait=Math.max(0,deadline-Date.now());
  if(wait){
   $('engine-status').textContent='Stockfish response delayed · clock running';
   await new Promise(resolve=>{
    const timer=setTimeout(()=>{delayedMove=null;resolve();},wait);
    delayedMove=()=>{clearTimeout(timer);resolve();};
   });
  }
  if(!current())return;
  // Search immediately; Arena retains its existing animation cadence.
  // The running clock still records real wall-clock time, including playback cadence.
  if(game?.mode==='arena'){const animations=$('board').getAnimations({subtree:true});if(animations.length){await Promise.allSettled(animations.map(a=>a.finished));if(!current())return;await new Promise(resolve=>{const timer=setTimeout(()=>{delayedMove=null;resolve();},150);delayedMove=()=>{clearTimeout(timer);resolve();};});}}
  return enqueue(async()=>{
  if(!current())return;
  searching=false;
  if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))throw Error('Engine returned no playable move');
  const legal=play(game,{from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});if(legal)sound();
  const premove=legal?executePremove(game):'none';selected=null;plan=null;
  instant=premove==='played';try{await persist();}finally{instant=false;}
  if(premove==='invalid')notice('Premove is no longer legal. The queue was cleared; no player move was made.',true);
  if(game.status==='finished')await ended();else scheduleEngine();
 });}).catch(error=>enqueue(async()=>{
  if(token!==generation||game?.id!==id)return;closeEngines();
  if(game.mode==='arena'){debit(game);game.clock.paused=true;game.revision++;await persist();}
  notice('Engine error: '+error.message+'. '+(game.mode==='arena'?'Arena paused; resume to retry.':'Clock continues. Reload to retry, or resign.'),true);
 }));
}
async function ended(){closeEngines();await renderArenaHistory();notice(`Game saved · ${game.reason}`);if(game.mode==='arena'&&game.arena.pending)await nextArena();}
async function nextArena(){
 const previous=game,token=generation;if(!previous?.arena?.pending||previous.arena.stopped)return;
 await new Promise(resolve=>setTimeout(resolve,0));
 if(token!==generation)return;
 const rank=(BigInt(previous.arena.rank)+1n).toString();
 let result;try{result=await generate(previous.arena.depth,rank);}catch(e){if(token!==generation)return;previous.arena.pending=false;await mutate(data=>{const stored=data.games.find(g=>g.id===previous.id);stored.arena.pending=false;});await mutate(d=>{recordArena(d,previous,previous);});await renderArenaHistory();notice('Arena series stopped: '+e.message);return;}
 if(token!==generation||previous.arena.stopped)return;
 const arena={...previous.arena,remaining:previous.arena.remaining-1,rank,pending:false};
 game=newGame(profile,{...prefs,base:previous.clock.base,increment:previous.clock.increment,difficulty:previous.difficulty},'arena',result.moves);game.arena=arena;game.pgn=pgn(game);
 await mutate(data=>{const stored=data.games.find(g=>g.id===previous.id);if(!stored?.arena?.pending)throw Error('Series already advanced');stored.arena.pending=false;recordArena(data,game,null);data.games.push(structuredClone(game));});
 prefs.openingRank=rank;await savePrefs(profile.id,prefs);$('opening-rank').value=rank;renderGame();$('arena-status').textContent=`Series running · ${arena.remaining} game(s) remaining · opening #${rank}`;scheduleEngine();
}
function sound(){if(!prefs?.sound)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=480;gain.gain.value=.04;osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.06);osc.onended=()=>ctx.close();}catch{}}
async function promote(){return new Promise(resolve=>{const dialog=$('promotion');const done=value=>{dialog.close();dialog.removeEventListener('click',click);dialog.removeEventListener('cancel',cancel);resolve(value);};const click=e=>{const value=e.target.dataset.promotion;if(value)done(value==='cancel'?null:value);};const cancel=e=>{e.preventDefault();done(null);};dialog.addEventListener('click',click);dialog.addEventListener('cancel',cancel);dialog.showModal();});}
async function humanMove(from,to,rect){
 if(humanMoving||!canInteract())return;
 humanMoving=true;
 try{
 const c=inputPosition();
 if(planning()){
  if(!showPlan)throw Error('Switch to the planned position to add premoves');
  if(!c.accepts(from,to))throw Error('That intention cannot be planned from this position');
  let promotion;if(c.get(from)?.type==='p'&&['1','8'].includes(to[1])){promotion=await promote();if(!promotion)return;}
  const m=from+to+(promotion||'');(game.premoves??=[]).push(m);c.apply(m);game.revision++;selected=null;
  renderGame();await persist();return;
 }
 const options=c.moves({square:from,verbose:true}).filter(m=>m.to===to);
 if(!options.length)throw Error('That move is not legal');
 let promotion;if(options.some(m=>m.promotion)){promotion=await promote();if(!promotion)return;}
 const legal=play(game,{from,to,promotion});if(legal&&rect)dropOrigin={to,rect};selected=null;if(legal)sound();await persist();if(game.status==='finished')await ended();else scheduleEngine();
 }finally{humanMoving=false;dropOrigin=null;}
}
function squareClick(square){enqueue(async()=>{
 if(!canInteract())return;
 const p=inputPosition().get(square);
 if(selected&&square!==selected&&p?.color!==game.player){const from=selected;await humanMove(from,square);}else{selected=selected===square?null:(p?.color===game.player?square:null);renderGame();}
});}
// Capture on the stable board, since rendering replaces its square buttons.
const board=$('board');
let drag=null,settling=null,suppressClick=false;
function canInteract(){return !humanMoving&&!storageBlocked&&game?.status==='active'&&game.mode!=='arena'&&(!planning()||showPlan);}
function cancelDrag(){
 settling?.();
 if(!drag)return;
 const d=drag;drag=null;
 d.piece.style.visibility='';d.layer?.remove();
 if(board.hasPointerCapture(d.id))board.releasePointerCapture(d.id);
}
board.addEventListener('click',e=>{
 if(suppressClick&&e.detail!==0){e.preventDefault();e.stopPropagation();suppressClick=false;return;}
 const square=(e.target.closest('[data-square]')||(e.detail?document.elementFromPoint(e.clientX,e.clientY)?.closest('#board [data-square]'):null))?.dataset.square;if(square&&!humanMoving)squareClick(square);
});
board.addEventListener('pointerdown',e=>{
 if(!e.isPrimary||e.button!==0||drag)return;
 suppressClick=false;
 settling?.();
 const square=e.target.closest('[data-square]')?.dataset.square;
 if(!canInteract()||!square||inputPosition().get(square)?.color!==game.player)return;
 const piece=board.querySelector(`[data-square="${square}"] .piece`);
 // Finish presentation animations before measuring the source square.
 cancelTransitions();
 drag={id:e.pointerId,from:square,piece,rect:piece.getBoundingClientRect(),x:e.clientX,y:e.clientY,game,revision:game.revision};
 board.setPointerCapture(e.pointerId);
});
board.addEventListener('pointermove',e=>{
 const d=drag;if(!d||e.pointerId!==d.id)return;
 const dx=e.clientX-d.x,dy=e.clientY-d.y;
 if(!d.layer&&Math.hypot(dx,dy)<4)return;
 e.preventDefault();
 if(!d.layer){
  suppressClick=true;
  d.layer=document.createElement('div');d.layer.className='drag-layer';d.layer.setAttribute('aria-hidden','true');
  d.ghost=d.piece.cloneNode(true);d.ghost.classList.add('drag-piece');
  const r=d.rect;
  Object.assign(d.ghost.style,{position:'absolute',visibility:'visible',left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px',fontSize:getComputedStyle(d.piece).fontSize});
  d.layer.append(d.ghost);document.body.append(d.layer);d.piece.style.visibility='hidden';
 }
 d.ghost.style.transform=`translate(${dx}px,${dy}px)`;
},{passive:false});
function releaseDrag(e,cancelled=false){
 const d=drag;if(!d||e.pointerId!==d.id)return;
 if(!d.layer){cancelDrag();return;}
 e.preventDefault();suppressClick=true;
 const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('#board [data-square]');
 const to=el?.dataset.square;
 const valid=!cancelled&&canInteract()&&game===d.game&&game.revision===d.revision&&inputDestinations(inputPosition(),d.from).includes(to);
 drag=null;
 if(board.hasPointerCapture(d.id))board.releasePointerCapture(d.id);
 let cleaned=false;
 const cleanup=()=>{if(cleaned)return;cleaned=true;d.piece.style.visibility='';d.layer.remove();if(settling===cleanup)settling=null;};
 if(valid){
  const rect=d.ghost.getBoundingClientRect();
  enqueue(()=>{if(game===d.game&&game.revision===d.revision)return humanMove(d.from,to,rect);}).finally(cleanup);
 }else{
  settling=cleanup;
  const animation=d.ghost.animate([{transform:d.ghost.style.transform},{transform:'translate(0,0)'}],{duration:movementDuration(prefs?.animationDuration),easing:'ease-out',fill:'forwards'});
  animation.finished.then(cleanup,cleanup);
 }
}
board.addEventListener('pointerup',e=>releaseDrag(e));
board.addEventListener('pointercancel',e=>releaseDrag(e,true));
board.addEventListener('lostpointercapture',e=>releaseDrag(e,true));
window.addEventListener('blur',cancelDrag);
window.addEventListener('resize',cancelDrag);
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
async function renderArchive(cursor=null,history=[],seriesId=null){
 $('archive-list').replaceChildren();if(!profile){$('archive-list').textContent='Create or select a profile in Settings first.';return;}const {games,next}=await archivePage(profile.id,cursor,50,seriesId);
 if(!games.length){$('archive-list').textContent='Your first game will appear here.';return;}
 for(const g of games){const row=document.createElement('div');row.className='archive-item';const info=document.createElement('div');const title=document.createElement('strong');title.textContent=`${g.result} · ${g.reason||'In progress'} · ${g.mode}`;const detail=document.createElement('small');detail.textContent=`${new Date(g.created).toLocaleString()} · ${g.moves.length} plies · stake ${formatCredits(g.stake)} × ${g.multiplier} · ${g.difficulty} · ${g.clock.base/60}+${g.clock.increment} · balance ${g.endingBalance==null?'pending':formatCredits(g.endingBalance)}`;info.append(title,detail);const actions=document.createElement('div');actions.className='actions';const replay=document.createElement('button');replay.textContent='Replay';replay.onclick=()=>{replayGame=g;replayPly=0;$('replay').showModal();renderReplay();};const exportBtn=document.createElement('button');exportBtn.textContent='Export PGN';exportBtn.onclick=()=>download(pgn(g),`chess-${g.id}.pgn`,'application/x-chess-pgn');actions.append(replay,exportBtn);row.append(info,actions);$('archive-list').append(row);}
 const navigation=document.createElement('div');navigation.className='actions';
 if(history.length){const back=document.createElement('button');back.textContent='Previous results';back.onclick=()=>enqueue(()=>renderArchive(history.at(-1),history.slice(0,-1),seriesId));navigation.append(back);}
 if(next){const more=document.createElement('button');more.textContent='Next results';more.onclick=()=>enqueue(()=>renderArchive(next,[...history,cursor],seriesId));navigation.append(more);}
 $('archive-list').append(navigation);
}
function renderReplay(){boardView($('replay-board'),chessFor(replayGame,replayPly));$('replay-title').textContent=`Replay · ${replayGame.result}`;$('replay-status').textContent=`Ply ${replayPly}/${replayGame.moves.length} · ${chessFor(replayGame,replayPly).history().at(-1)||'Starting position'}`;$('replay-prev').disabled=replayPly===0;$('replay-next').disabled=replayPly===replayGame.moves.length;}
function download(text,name,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function unlocked(p){
 closeEngines();selected=null;plan=null;showPlan=true;opening=null;profile=p;prefs={...structuredClone(DEFAULTS),...p.prefs};$('club').hidden=false;setUnlocked(true);await renderProfiles();applyPrefs();await refreshProfile();
 const data=await read(),games=data.games.filter(g=>g.profileId===p.id).sort((a,b)=>b.created-a.created);game=games.find(g=>g.status==='active')||games.find(g=>g.mode==='arena'&&g.arena?.pending)||games[0]||null;
 renderGame();await renderArenaHistory();if(game?.status==='active')showGame();notice('Profile loaded · all data stays on this device');
 if(game?.status==='active'){if(timeout(game)){await persist();await ended();}else scheduleEngine();}else if(game?.arena?.pending)await nextArena();
}
async function renderProfiles(){
 const data=await read();$('profile-select').replaceChildren();
 const placeholder=new Option('Select a user', '');placeholder.disabled=true;placeholder.selected=!profile;$('profile-select').append(placeholder);
 for(const p of data.profiles.filter(isGenerated))$('profile-select').append(new Option(p.name,p.id,false,p.id===profile?.id));
 for(const selector of ['#new-game-form','#arena-form','#multiplier-form'])for(const e of document.querySelector(selector).querySelectorAll('input,select,button'))e.disabled=!profile;
 for(const id of ['theme','animation-duration','response-delay','response-delay-custom','sound','opening-jump','opening-prev','opening-next','opening-play'])$(id).disabled=!profile;
 $('profile-summary').hidden=!profile;
}
async function loadCurrent(){
 closeEngines();profile=null;game=null;const data=await read(),p=data.profiles.find(p=>p.id===data.lastProfile&&isGenerated(p));
 if(p)return unlocked(p);
 prefs=structuredClone(DEFAULTS);$('club').hidden=false;setUnlocked(true);applyPrefs();await renderProfiles();renderGame();notice('No profile selected. Open Settings and use Generate User to create one.');
}
async function pauseForSwitch(){
 if(game?.status==='active'&&game.mode==='arena'){closeEngines();debit(game);game.clock.paused=true;game.revision++;await persist();}
}
$('premove-list').addEventListener('scroll',renderQueue);
$('premove-view').onclick=()=>{showPlan=!showPlan;selected=null;renderGame();};
for(const [id,undo] of [['premove-clear',false],['premove-undo',true]])$(id).onclick=()=>enqueue(async()=>{
 if(!game?.premoves?.length)return;
 if(undo){game.premoves.pop();plan?.undo();}else{game.premoves=[];plan=null;}
 game.revision++;selected=null;renderGame();await persist();
});
$('generate-user').onclick=()=>{$('creation-pin').returnValue='';$('pin').value='';$('creation-pin').showModal();};
$('creation-pin').addEventListener('close',()=>{const pin=$('pin').value;$('pin').value='';if($('creation-pin').returnValue!=='generate')return;enqueue(async()=>{if(!canWrite)throw Error('Another tab owns local storage');if(pin!=='1111')throw Error('Incorrect creation PIN');await pauseForSwitch();await unlocked(await createProfile(pin));});});
$('profile-select').onchange=()=>enqueue(async()=>{await pauseForSwitch();await unlocked(await selectProfile($('profile-select').value));});
$('retry-save').onclick=()=>enqueue(async()=>{storageBlocked=false;if(stoppingArena){await stopSeries();return;}ticking=false;timeout(game);await persist();notice('Game saved successfully.');if(game.status==='finished')await ended();else scheduleEngine();},true);
for(const btn of document.querySelectorAll('[data-tab]'))btn.onclick=()=>tab(btn.dataset.tab);
$('new-game-form').onsubmit=e=>{e.preventDefault();enqueue(async()=>{await capturePrefs();if(!await abandon())return;let sequence=[];if($('use-opening').checked)sequence=(await loadOpening()).moves;await launch($('mode').value,sequence);});};
$('move-form').onsubmit=e=>{e.preventDefault();enqueue(()=>humanMove($('from').value.toLowerCase(),$('to').value.toLowerCase()));};
$('resign').onclick=()=>enqueue(async()=>{if(game?.status!=='active'||game.mode==='arena')return;closeEngines();finish(game,game.player==='w'?'0-1':'1-0','Player resigned');await persist();await ended();});
$('claim').onclick=()=>enqueue(async()=>{if(game?.status!=='active'||game.mode==='arena'||chessFor(game).turn()!==game.player||!claimable(game))return;closeEngines();finish(game,'1/2-1/2','Player claimed 50-move rule or threefold repetition');await persist();await ended();});
$('undo').onclick=()=>enqueue(async()=>{if(game?.status!=='active'||game.mode!=='analysis'||game.moves.length<=game.openingPlies)return;if(timeout(game)){await persist();await ended();return;}closeEngines();debit(game);do{game.moves.pop();}while(game.moves.length>game.openingPlies&&chessFor(game).turn()!==game.player);game.clock.since=Date.now();game.premoves=[];plan=null;game.revision++;selected=null;await persist();scheduleEngine();});
$('preset').onchange=()=>enqueue(async()=>{if($('preset').value!=='custom'){const [base,increment]=$('preset').value.split(',').map(Number);$('base').value=base/60;$('increment').value=increment;}await capturePrefs();if(!game)renderClocks();});
$('stake').onfocus=()=>{$('stake').value=$('stake').value.replaceAll('.','');};
$('stake').onblur=()=>{if(/^\d+$/.test($('stake').value))$('stake').value=formatCredits($('stake').value);};
for(const id of ['difficulty','color','stake','base','increment'])$(id).onchange=()=>enqueue(async()=>{await capturePrefs();if(!game)renderGame();});
for(const id of ['response-delay','response-delay-custom'])$(id).onchange=()=>enqueue(async()=>{
 const custom=$('response-delay').value==='custom';$('response-delay-custom').hidden=!custom;
 const raw=custom?$('response-delay-custom').value:$('response-delay').value,value=Number(raw);
 if(!raw.trim()||!Number.isFinite(value)||value<0||value>300)throw Error('Response delay must be 0–300 seconds');
 prefs.responseDelay=value;await savePrefs(profile.id,prefs);
});
$('animation-duration').onchange=()=>enqueue(async()=>{prefs.animationDuration=Number($('animation-duration').value);cancelTransitions();await savePrefs(profile.id,prefs);});
$('theme').onchange=()=>enqueue(async()=>{prefs.theme=$('theme').value;document.body.dataset.theme=prefs.theme;await savePrefs(profile.id,prefs);});$('sound').onchange=()=>enqueue(async()=>{prefs.sound=$('sound').checked;await savePrefs(profile.id,prefs);});
$('multiplier-form').onsubmit=e=>{e.preventDefault();enqueue(async()=>{const multipliers={};for(const input of document.querySelectorAll('[data-level]')){if(!/^\d+$/.test(input.value))throw Error('Multipliers must be whole non-negative integers');multipliers[input.dataset.level]=BigInt(input.value).toString();}prefs.multipliers=multipliers;await savePrefs(profile.id,prefs);payoutNote();notice('Multipliers saved. Existing game terms stay locked.');});};
$('opening-jump').onclick=()=>enqueue(()=>loadOpening());$('opening-prev').onclick=()=>enqueue(()=>loadOpening((BigInt($('opening-rank').value)-1n).toString()));$('opening-next').onclick=()=>enqueue(()=>loadOpening((BigInt($('opening-rank').value)+1n).toString()));$('opening-cancel').onclick=()=>openingReject?.();$('opening-play').onclick=()=>{tab('play');$('use-opening').checked=true;};
$('arena-form').onsubmit=e=>{e.preventDefault();enqueue(async()=>{const count=arenaCount($('arena-count').value),speed=Number($('arena-speed').value);if(!Number.isInteger(speed)||speed<20||speed>2000)throw Error('Arena think time: 20–2000 ms');await capturePrefs();if(!await abandon())return;const result=await loadOpening();await launch('arena',result.moves,{remaining:count,speed,depth:result.depth,rank:result.rank,pending:false});$('arena-status').textContent=`Series running · ${count} game(s) remaining`;});};
async function renderArenaHistory(){
 const data=await read(),list=$('arena-history');list.replaceChildren();
 for(const row of (data.arenaSeries||[]).filter(s=>s.profileId===profile?.id).slice().reverse()){
  const el=document.createElement('p');el.textContent=`${new Date(row.created).toLocaleString()} · ${row.status} · ${row.completed} completed · White ${row.white} / Black ${row.black} / Draws ${row.draws} · Points ${row.whitePoints}–${row.blackPoints} · Elo ${row.config.difficulty} · ${row.config.base/60}+${row.config.increment} · ${row.config.speed} ms · opening depth ${row.config.depth}, #${row.config.rank}`;const review=document.createElement('button');review.textContent='Review games';review.onclick=()=>{tab('archive');enqueue(()=>renderArchive(null,[],row.id));};el.append(document.createElement('br'),review);list.append(el);
 }
}
async function stopSeries(){
 if(game?.mode!=='arena'||game.arena?.stopped)return;
 closeEngines();cancelTransitions();openingReject?.();
 stoppingArena=true;if(game.status==='active'){debit(game);game.clock.paused=true;}
 try{game=await stopArena(game);stoppingArena=false;storageBlocked=false;storageFailure='';$('retry-save').hidden=true;}
 catch(error){storageBlocked=true;$('retry-save').hidden=false;storageFailure='STOP could not be saved: '+error.message+'. Keep this tab open and use Retry failed save.';throw Error(storageFailure);}
 await refreshProfile();renderGame();await renderArenaHistory();
 tab('arena');$('arena-status').textContent='Series stopped · completed results saved below';$('arena-history').firstElementChild?.scrollIntoView({block:'nearest'});notice('Arena stopped · completed results saved');
}
$('arena-stop').onclick=()=>{
 if(game?.mode!=='arena'||game.arena?.stopped)return;
 // Invalidate searches and opening computation before waiting for the write queue.
 closeEngines();cancelTransitions();openingReject?.();stoppingArena=true;if(game.status==='active'){debit(game);game.clock.paused=true;}enqueue(stopSeries,true);
};
$('arena-pause').onclick=()=>enqueue(async()=>{if(game?.status!=='active'||game.mode!=='arena')return;closeEngines();if(timeout(game)){await persist();await ended();return;}debit(game);game.clock.paused=!game.clock.paused;game.clock.since=Date.now();game.revision++;await persist();scheduleEngine();});
$('replay-prev').onclick=()=>{if(replayPly>0){replayPly--;renderReplay();}};$('replay-next').onclick=()=>{if(replayPly<replayGame.moves.length){replayPly++;renderReplay();}};$('replay-close').onclick=()=>{$('replay').close();};
$('replay').addEventListener('close',cancelTransitions);
$('export-json').onclick=()=>enqueue(async()=>{download(JSON.stringify(await readBackup()),'stockfish-credit-chess-backup.json');notice('Backup exported. It contains sensitive local profiles and retained legacy records.');});
$('export-encrypted').onclick=()=>enqueue(async()=>{const data=await encryptBackup(await readBackup(),$('backup-password').value);download(JSON.stringify(data),'stockfish-credit-chess-encrypted.json');$('backup-password').value='';notice('Encrypted backup exported. Keep its password safe.');});
$('import-file').onchange=()=>enqueue(async()=>{
 if(game?.status==='active')throw Error('Finish the current game before importing a backup');
 const file=$('import-file').files[0];if(!file)return;if(file.size>20*1024*1024)throw Error('Backup exceeds 20 MB');let input=JSON.parse(await file.text());if(input.encrypted)input=await decryptBackup(input,$('backup-password').value);closeEngines();const result=await importBackup(input);await ensureArenaHistory();await renderProfiles();$('backup-password').value='';$('import-file').value='';notice(`Imported ${result.addedProfiles} profiles and ${result.addedGames} games; kept ${result.conflicts} conflicting records. A pre-import recovery copy is available.`);
});
$('recover').onclick=()=>enqueue(async()=>{if(game?.status==='active')throw Error('Finish the current game before recovery');if(!confirm('Restore the pre-import snapshot? The current data will become the new recovery copy.'))return;await restoreRecovery();await ensureArenaHistory();await loadCurrent();notice('Pre-import data restored.');});
let ticking=false;
setInterval(()=>{if(!profile||!game)return;renderClocks();if(storageBlocked)return;if(!ticking&&game.status==='active'&&!game.clock.paused&&remaining(game)[chessFor(game).turn()]<=0){ticking=true;enqueue(async()=>{try{if(timeout(game)){closeEngines();await persist();await ended();}}finally{ticking=false;}});}},200);
window.addEventListener('pagehide',()=>{cancelTransitions();closeEngines();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelTransitions();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
async function init(){
 await read();
 if(!navigator.locks)throw Error('This browser lacks Web Locks. Use an up-to-date mobile browser to protect local credit writes.');
 navigator.locks.request('stockfish-credit-chess-writer',{ifAvailable:true},async lock=>{
  if(!lock){notice('Another chess tab is open. Close it and reload this page to protect clocks and credits.',true);return;}
  canWrite=true;
  try {await ensureArenaHistory();await loadCurrent();
   if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async reg=>{await navigator.serviceWorker.ready;$('storage-status').textContent='Offline cache ready. IndexedDB stores profiles and games.';}).catch(e=>{$('storage-status').textContent='Offline caching unavailable: '+e.message;});
   if(navigator.storage?.persist){navigator.storage.persist().then(granted=>{if(!granted)$('storage-status').textContent+=' Browser storage may be evicted; export regular backups.';});}
  }catch(e){notice('Local storage/application error: '+e.message+'. Reload to retry. Do not clear browser data without a backup.',true);}
  await new Promise(()=>{});
 }).catch(e=>notice('Cannot acquire local storage lock: '+e.message,true));
}
init().catch(e=>notice('Local storage unavailable: '+e.message+'. Check browser storage permissions and reload.',true));

