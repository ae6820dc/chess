import {cancelTransitions} from './animation.js';
// UI geometry only. Game rules, engine searches, storage and clock data are independent.
const $ = id => document.getElementById(id);
const desktop = matchMedia('(min-width: 560px) and (orientation: landscape) and (min-height: 600px)');
let pane = 'match';

export function setPane(next) {
  pane = next;
  document.querySelector('.play-layout').dataset.pane = pane;
  $('match-toggle').setAttribute('aria-expanded', String(desktop.matches || pane === 'match'));
  $('history-toggle').setAttribute('aria-expanded', String(desktop.matches || pane === 'history'));
}

export function setUnlocked(unlocked) {
  document.body.classList.toggle('unlocked', unlocked);
  document.documentElement.classList.toggle('app-unlocked', unlocked);
  $('profile-summary').hidden = !unlocked;
  if (unlocked) window.scrollTo(0, 0);
}

export function showGame() {
  // Tall landscape keeps both panes; other screens close setup when play starts.
  if (!desktop.matches) setPane('none');
}

function updateViewport() {
  // Android's virtual keyboard can shrink visualViewport without changing 100dvh.
  // Native pinch zoom is deliberately left alone.
  const viewport = window.visualViewport;
  if (!viewport || viewport.scale === 1) {
    document.documentElement.style.setProperty('--app-height', `${viewport?.height || innerHeight}px`);
  }
}

function fitBoard(stage) {
  const board = stage.querySelector('.board');
  const {width, height} = stage.getBoundingClientRect();
  const size = Math.floor(Math.min(width, height));
  if (size <= 0) return; // Hidden tabs/dialogs get measured when shown.
  if(board.style.getPropertyValue('--board-size')!==`${size}px`)cancelTransitions();
  board.style.setProperty('--board-size', `${size}px`);
  stage.parentElement.style.setProperty('--fitted-size', `${size}px`);
  board.style.setProperty('--piece-size', `${(size - 4) * .12}px`);
  board.style.setProperty('--coordinate-size', `${Math.min(10, size * .022)}px`);
}

const observer = new ResizeObserver(entries => {
  for (const {target} of entries) fitBoard(target);
});
for (const stage of document.querySelectorAll('.board-stage')) observer.observe(stage);
window.addEventListener('resize', updateViewport);
window.visualViewport?.addEventListener('resize', updateViewport);
desktop.addEventListener('change', () => setPane(pane));
$('match-toggle').onclick = () => setPane(pane === 'match' ? 'none' : 'match');
$('history-toggle').onclick = () => setPane(pane === 'history' ? 'none' : 'history');
$('panel-close')?.addEventListener('click',()=>{setPane('none');$('match-toggle').focus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')setPane('none');});
updateViewport();
setPane(document.body.dataset.interface === 'tablet'&&!desktop.matches?'none':pane);
