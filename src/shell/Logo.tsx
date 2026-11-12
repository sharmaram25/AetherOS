export function Logo({ size = 64, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={glow ? { filter: 'drop-shadow(0 0 24px rgba(129,140,248,0.55))' } : undefined}>
      <defs>
        <linearGradient id="lg-a" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a5b4fc" />
          <stop offset="0.5" stopColor="#818cf8" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="lg-b" x1="20" y1="18" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <path d="M32 4 56 18v28L32 60 8 46V18L32 4Z" fill="url(#lg-a)" />
      <path d="M32 4 56 18v28L32 60 8 46V18L32 4Z" fill="url(#lg-a)" opacity="0.4" transform="translate(0 0) scale(1)" />
      <path d="M32 16 44 23v14L32 44l-12-7V23l12-7Z" fill="url(#lg-b)" />
      <path d="M32 16v14m0 0 12-7M32 30l-12-7" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
