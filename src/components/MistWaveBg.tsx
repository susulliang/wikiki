/* Animated wave background for the Mist Wave theme.
 *
 * Renders 6 layered SVG wave bands, each rotated 45° across the viewport.
 * Each band has its own per-band CSS animation that slowly translates
 * horizontally and breathes vertically, producing an ever-changing
 * "peaks and grooves" surface. Bands use the mint accent at varying
 * low opacities so the whole field reads as a calm minty mist over
 * the greyish bg.
 *
 * Bands are sized much larger than the viewport (300% wide × 100vh tall)
 * so that after the 45° rotation, all four rectangular corners land
 * well off-screen — no hard cutoff edges are visible. The parent
 * .mist-wave-bg has overflow: hidden + a slight blur to keep text
 * readable.
 *
 * Fixed, pointer-events-none, only visible when :root.mist-wave is on.
 */

interface BandConfig {
  /** Vertical amplitude of the wave in viewBox units. */
  amp: number;
  /** Top offset of the band as a fraction of viewport height.
   *  Wave sits at band vertical center, so top=-0.4 puts the wave at 10vh. */
  top: number;
  /** Animation duration in seconds for the horizontal drift. */
  driftDur: number;
  /** Animation duration in seconds for the vertical breathing. */
  breathDur: number;
  /** Negative animation delay in seconds (stagger bands). */
  delay: number;
  /** Peak opacity for the band (0-1). */
  opacity: number;
  /** Per-band path scale (consumed via --mist-scale CSS var). */
  scale: number;
}

// Spread waves from ~10vh to ~90vh so they cover the full viewport
// vertically. Negative top values push the band (and thus its top fill
// area) off-screen, which combined with the 300% width eliminates the
// corner cutoffs after 45° rotation.
const BANDS: BandConfig[] = [
  { amp: 34, top: -0.40, driftDur: 38, breathDur: 16, delay: 0,    opacity: 0.20, scale: 1.0 },
  { amp: 46, top: -0.24, driftDur: 44, breathDur: 19, delay: -4,   opacity: 0.16, scale: 1.1 },
  { amp: 28, top: -0.08, driftDur: 32, breathDur: 14, delay: -8,   opacity: 0.24, scale: 0.9 },
  { amp: 52, top:  0.08, driftDur: 52, breathDur: 23, delay: -12,  opacity: 0.14, scale: 1.2 },
  { amp: 38, top:  0.24, driftDur: 40, breathDur: 18, delay: -6,   opacity: 0.18, scale: 1.0 },
  { amp: 32, top:  0.40, driftDur: 36, breathDur: 17, delay: -10,  opacity: 0.16, scale: 1.0 },
];

export default function MistWaveBg() {
  return (
    <div className="mist-wave-bg" aria-hidden="true">
      {BANDS.map((b, i) => (
        <WaveBand key={i} {...b} />
      ))}
    </div>
  );
}

function WaveBand({ amp, top, driftDur, breathDur, delay, opacity, scale }: BandConfig) {
  // Path is wider than the viewport (1400 vs 1000 viewBox) so that when
  // we translateX it horizontally for the drift animation, no edge gap
  // appears. The closed shape (L 1400 200 L 0 200 Z) fills below the
  // wave so each band reads as a soft translucent layer.
  const path = `M 0 100 C 175 ${100 - amp}, 350 ${100 + amp}, 700 100 S 1225 ${100 - amp}, 1400 100 L 1400 200 L 0 200 Z`;
  return (
    <div
      className="mist-wave-band"
      style={{
        top: `${top * 100}%`,
        opacity,
        animationDuration: `${breathDur}s`,
        animationDelay: `${delay}s`,
      }}
    >
      <svg
        className="mist-wave-svg"
        viewBox="0 0 1400 200"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="mist-wave-path"
          d={path}
          fill="currentColor"
          style={{
            // Expose scale as a CSS var so the mist-wave-drift keyframe
            // (which owns `transform`) can pick it up. Setting transform
            // inline would be overridden by the animation.
            ['--mist-scale' as string]: `${scale}`,
            animationDuration: `${driftDur}s`,
            animationDelay: `${delay}s`,
          }}
        />
      </svg>
    </div>
  );
}
