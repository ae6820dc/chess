// Browser UCI adapter. A worker is never shared across games or arena sides.
export class StockfishAdapter {
  constructor(onStatus = () => {}) {
    this.onStatus = onStatus;
    this.worker = new Worker(new URL('./vendor/stockfish-18-lite-single.js', import.meta.url));
    this.waiters = [];
    this.options = [];
    this.worker.onmessage = ({ data }) => {
      for (const line of String(data).split('\n')) {
        if (line.startsWith('option ')) this.options.push(line);
        for (const w of [...this.waiters]) if (w.match(line)) { this.waiters.splice(this.waiters.indexOf(w), 1); clearTimeout(w.timer); w.resolve(line); }
      }
    };
    this.worker.onerror = e => { this.fail(new Error(`Stockfish failed to load: ${e.message}`)); onStatus('Engine error'); };
    this.ready = this.initialize();
  }
  send(command) { if (this.closed) throw new Error('Engine closed'); this.worker.postMessage(command); }
  wait(match, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const w = { match, resolve, reject };
      w.timer = setTimeout(() => { this.waiters = this.waiters.filter(x => x !== w); reject(new Error('Stockfish response timed out')); }, timeout);
      this.waiters.push(w);
    });
  }
  async initialize() {
    this.onStatus('Loading Stockfish 18…');
    const uci = this.wait(l => l === 'uciok'); this.send('uci'); await uci;
    const option = this.options.find(l => l.startsWith('option name UCI_Elo '));
    const range = option?.match(/min (\d+) max (\d+)/);
    if (!range || !this.options.some(l => l.startsWith('option name UCI_LimitStrength '))) throw new Error('Engine lacks UCI strength controls');
    this.eloRange = { min: Number(range[1]), max: Number(range[2]) };
    this.send('setoption name Hash value 16');
    const ready = this.wait(l => l === 'readyok'); this.send('isready'); await ready;
    this.onStatus(`Stockfish 18 ready · UCI Elo ${range[1]}–${range[2]}`);
    return this.eloRange;
  }
  async move({ moves, difficulty, milliseconds = 500, clocks, increment = 0 }) {
    await this.ready;
    if (this.busy) throw new Error('Engine search already running');
    this.busy = true;
    try {
      this.send(`setoption name UCI_LimitStrength value ${difficulty !== 'MAX'}`);
      if (difficulty !== 'MAX') {
        const elo = Number(difficulty);
        if (!Number.isInteger(elo) || elo < this.eloRange.min || elo > this.eloRange.max) throw new Error('Unsupported UCI Elo');
        this.send(`setoption name UCI_Elo value ${elo}`);
      }
      this.send(`position startpos${moves.length ? ' moves ' + moves.join(' ') : ''}`);
      const result = this.wait(l => l.startsWith('bestmove '), Math.max(20000, milliseconds + 10000));
      // movetime caps mobile CPU; wtime/btime include real remaining clock time.
      const time = clocks ? ` wtime ${Math.max(1, Math.floor(clocks.w))} btime ${Math.max(1, Math.floor(clocks.b))} winc ${increment} binc ${increment}` : '';
      this.send(`go${time} movetime ${Math.max(1, Math.floor(milliseconds))}`);
      return (await result).split(' ')[1];
    } finally { this.busy = false; }
  }
  fail(error) { for (const w of this.waiters.splice(0)) { clearTimeout(w.timer); w.reject(error); } }
  close() { if (this.closed) return; this.closed = true; this.worker.terminate(); this.fail(new Error('Engine cancelled')); }
}
