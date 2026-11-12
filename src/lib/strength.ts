const COMMON = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'letmein', 'monkey', 'dragon', 'iloveyou', 'admin', 'welcome', 'login',
  'princess', 'football', 'baseball', 'master', 'sunshine', 'shadow', 'trustno1', 'passw0rd', 'superman', 'hello', 'freedom',
  'whatever', 'qazwsx', 'starwars', '111111', '000000', '123123', '654321', 'password1', 'qwerty123', '1q2w3e4r', 'secret',
]);

export interface Strength { score: 0 | 1 | 2 | 3 | 4; bits: number; label: string; crack: string; color: string }

/**
 * Entropy estimate with pattern penalties. Crack time assumes an offline attacker making
 * 10^10 guesses/sec on a raw hash, divided by our KDF cost where relevant (`kdf = true`).
 */
export function strength(pw: string, kdf = false): Strength {
  if (!pw) return { score: 0, bits: 0, label: 'Empty', crack: '—', color: '#64748b' };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  if (/[^\x00-\x7f]/.test(pw)) pool += 100;
  let bits = pw.length * Math.log2(Math.max(pool, 1));

  const lower = pw.toLowerCase();
  if (COMMON.has(lower) || COMMON.has(lower.replace(/[0-9!@#$]+$/, ''))) bits = Math.min(bits, 10);
  if (/^(.)\1+$/.test(pw)) bits = Math.min(bits, 6);
  if (/(?:abc|bcd|cde|123|234|345|456|567|678|789|qwe|wer|asd|zxc)/i.test(pw)) bits -= 8;
  const repeats = pw.length - new Set(pw).size;
  bits -= repeats * 1.5;
  // Multi-word passphrases are strong even when lowercase.
  const words = pw.trim().split(/[\s\-_.]+/).filter((w) => w.length >= 3);
  if (words.length >= 4) bits = Math.max(bits, words.length * 12.9);
  bits = Math.max(0, Math.round(bits));

  const score = (bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4) as Strength['score'];
  const guessesPerSec = kdf ? 1e10 / 600_000 : 1e10;
  const seconds = 2 ** bits / 2 / guessesPerSec;
  return {
    score, bits,
    label: ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'][score],
    crack: humanTime(seconds),
    color: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6'][score],
  };
}

function humanTime(s: number) {
  if (s < 1) return 'instantly';
  const units: [number, string][] = [[60, 'second'], [60, 'minute'], [24, 'hour'], [365, 'day'], [100, 'year'], [10, 'century']];
  let v = s;
  for (const [n, name] of units) {
    if (v < n) return `${Math.round(v)} ${name}${Math.round(v) === 1 ? '' : 's'}`;
    v /= n;
  }
  return v > 1e6 ? 'longer than the universe has existed' : `${Math.round(v).toLocaleString()} millennia`;
}

const WORDS = 'able acid aged also area army away baby back ball band bank base bath bear beat bell belt best bird blow blue boat body bone book boot born boss both bowl bulk burn bush busy cake calm came camp card care cart case cash cast cell chat chip city clay club coal coat code cold comb cone cook cool cope copy cord core corn cost crew crop cube cure dark data dawn deal dear deck deep deer desk dial diet dirt dish dock dome door dose down draw drop drum dual duck dune dust duty each earn ease east echo edge else epic even exit face fact fade fair fall farm fast fate fear feed feel fern file fill film find fine fire firm fish five flag flat flow foam fold folk font food foot fork form fort four free frog fuel full fund gain game gate gear gift girl give glad glow glue goal gold golf good gown grab gray grid grin grip grow gulf hair half hall hand hang hard harp hawk head heat herb hero hide high hill hint hive hold hole home hood hook hope horn host hour huge hunt icon idea inch iron isle item jade jazz jean join joke jump jury keen keep kelp kind king kite knee knot lace lake lamp land lane last lava lawn lead leaf lens life lift lily lime line link lion list load loaf lock loft logo long loop lord luck lung made mail main make malt mane many maps mask mast math maze meal melt memo menu mesh mild milk mill mind mint mist mode mole moon moss moth move much mule muse nail name navy neat neck nest news next nice node noon nose note oath ogre once onyx open oval oven palm park part path peak pear pine pink pipe plan plum poem poet pond pony pool port pose post pour prop pure quiz race raft rail rain ramp rank rare reed reef rest rice rich ride ring rise road rock roof room root rope rose ruby rule rush safe sage sail salt sand save seal seed self ship shoe shop silk sing sink site size skip slab slow snow soap sock soft soil song soup spin spot star stem step stew suit swan tail tale tape task team tent term tide tile time tint tiny tone tool town tram tree trim trip tuba tune twin type unit vase vast veil vent verb vest view vine visa void volt vote wade wage wall wand warm wave weed well west whip wide wild wind wing wire wise wolf wood wool word work yard yarn year yoga zero zinc zone'.split(' ');

export function generatePassword(opts: { length: number; upper: boolean; digits: boolean; symbols: boolean; words?: boolean; wordCount?: number; separator?: string }) {
  const rand = (n: number) => {
    const max = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    do crypto.getRandomValues(buf); while (buf[0] >= max);
    return buf[0] % n;
  };
  if (opts.words) {
    const n = opts.wordCount ?? 5;
    const out = Array.from({ length: n }, () => WORDS[rand(WORDS.length)]);
    if (opts.upper) out[rand(n)] = out[rand(n)].replace(/^./, (c) => c.toUpperCase());
    if (opts.digits) out.push(String(rand(100)));
    return out.join(opts.separator ?? '-');
  }
  let chars = 'abcdefghijkmnopqrstuvwxyz';
  const sets = [chars];
  if (opts.upper) { chars += 'ABCDEFGHJKLMNPQRSTUVWXYZ'; sets.push('ABCDEFGHJKLMNPQRSTUVWXYZ'); }
  if (opts.digits) { chars += '23456789'; sets.push('23456789'); }
  if (opts.symbols) { chars += '!@#$%^&*-_=+?'; sets.push('!@#$%^&*-_=+?'); }
  for (;;) {
    const pw = Array.from({ length: opts.length }, () => chars[rand(chars.length)]).join('');
    if (sets.every((s) => [...pw].some((c) => s.includes(c))) || opts.length < sets.length) return pw;
  }
}
