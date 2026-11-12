/** Tiny synthesized UI sounds — no audio files, no network. */
let ctx: AudioContext | null = null;

type Kind = 'notify' | 'error' | 'click' | 'unlock' | 'lock' | 'alarm' | 'trash';

const RECIPES: Record<Kind, [number, number, number][]> = {
  // [frequency, startOffset, duration]
  notify: [[880, 0, 0.12], [1320, 0.09, 0.18]],
  error: [[220, 0, 0.18], [180, 0.12, 0.22]],
  click: [[1800, 0, 0.03]],
  unlock: [[660, 0, 0.1], [990, 0.08, 0.1], [1320, 0.16, 0.2]],
  lock: [[990, 0, 0.1], [660, 0.08, 0.18]],
  alarm: [[880, 0, 0.2], [880, 0.3, 0.2], [880, 0.6, 0.2], [1175, 0.9, 0.4]],
  trash: [[400, 0, 0.06], [250, 0.05, 0.12]],
};

export function sound(kind: Kind, volume = 0.06) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    for (const [f, off, dur] of RECIPES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'error' ? 'triangle' : 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t0 + off);
      gain.gain.linearRampToValueAtTime(volume, t0 + off + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + off + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + off);
      osc.stop(t0 + off + dur + 0.02);
    }
  } catch { /* audio unavailable */ }
}
