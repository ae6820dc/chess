// Presentation only: the renderer commits the logical position before animating.
const positions = new WeakMap();
const active = new Set();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
export function movementDuration(value = 600, respectMotion = true) {
  return respectMotion && (reduced.matches || document.hidden) ? 0 :
    [0,250,400,600,800,1000].includes(value) ? value : 600;
}
export function cancelTransitions() {
  for (const animation of active) animation.cancel();
  active.clear();
}
reduced.addEventListener('change', cancelTransitions);
window.addEventListener('resize', cancelTransitions);
window.visualViewport?.addEventListener('resize', cancelTransitions);
export function prepareTransition(board, chess, orientation) {
  // Superseding renders always snap to the last committed state first.
  for (const animation of board.getAnimations({subtree:true})) animation.cancel();
  const previous = positions.get(board);
  const history = chess.history({verbose:true});
  positions.set(board, {history, orientation});
  if (!previous || previous.orientation !== orientation) return [];
  const old = previous.history;
  const forward = history.length === old.length + 1;
  const backward = old.length === history.length + 1;
  if (!forward && !backward) return [];
  const prefix = forward ? old : history;
  const longer = forward ? history : old;
  if (!prefix.every((m,i)=>m.lan===longer[i].lan)) return [];
  const move = longer.at(-1), paths = [[move.from,move.to]];
  if (move.flags.includes('k')) paths.push(['h'+move.from[1],'f'+move.from[1]]);
  if (move.flags.includes('q')) paths.push(['a'+move.from[1],'d'+move.from[1]]);
  return paths.map(([from,to])=> {
    if (backward) [from,to]=[to,from];
    return {to, rect:board.querySelector(`[data-square="${from}"] .piece`)?.getBoundingClientRect()};
  });
}
export function animateTransition(board, paths, preference) {
  const duration = movementDuration(preference);
  if (!duration) return;
  for (const {to,rect} of paths) {
    const piece = board.querySelector(`[data-square="${to}"] .piece`);
    if (!piece || !rect || !rect.width) continue;
    const end = piece.getBoundingClientRect();
    if (!end.width) continue;
    piece.style.position='relative';
    piece.style.zIndex='2';
    const animation = piece.animate([
      {transform:`translate(${rect.x-end.x}px,${rect.y-end.y}px)`},
      {transform:'translate(0,0)'}
    ], {duration,easing:'cubic-bezier(.25,.1,.25,1)'});
    active.add(animation);
    const cleanup=()=>{active.delete(animation);piece.style.removeProperty('z-index');};
    animation.finished.then(cleanup,cleanup);
  }
}
