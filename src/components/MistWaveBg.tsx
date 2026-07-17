/* Animated wave background for the Mist Wave theme.
 *
 * Renders 4 layered SVG wave bands, each rotated 45° across the viewport.
 * Each band has its own per-band CSS animation that slowly translates
 * horizontally and breathes vertically, producing an ever-changing
 * "peaks and grooves" surface. Bands use the mint accent at varying
 * low opacities so the whole field reads as a calm minty mist over
 * the greyish bg.
 *
 * Bands are sized much larger than the viewport (400% wide × 120vh tall)
 * so that after the 45° rotation, all four rectangular corners land
 * well off-screen — no hard cutoff edges are visible, even at the
 * diagonal extremes. The parent .mist-wave-bg has overflow: hidden
 * (no blur — waves are crisp).
 *
 * Fixed, pointer-events-none, only visible when :root.mist-wave is on.
 */

interface BandConfig {
  /** Vertical amplitude of the wave in viewBox units. Larger = fatter peaks. */
  amp: number;
  /** Top offset of the band as a fraction of viewport height.
   *  Wave sits at band vertical center, so top=-0.5 puts the wave at 10vh. */
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

// 4 waves spread from ~5vh to ~95vh — covering the full viewport with
// generous spacing between each band. Negative top values push the band
// (and its top fill area) off-screen, which combined with the 400% width
// eliminates all corner cutoffs after 45° rotation.
// Amplitudes are large (50-70) for fat, pronounced wave shapes.
const BANDS: BandConfig[] = [
  { amp: 60, top: -0.50, driftDur: 42, breathDur: 18, delay: 0,    opacity: 0.22, scale: 1.0 },
  { amp: 50, top: -0.15, driftDur: 50, breathDur: 22, delay: -5,   opacity: 0.18, scale: 1.1 },
  { amp: 70, top:  0.20, driftDur: 46, breathDur: 20, delay: -10,  opacity: 0.20, scale: 1.2 },
  { amp: 55, top:  0.55, driftDur: 38, breathDur: 16, delay: -7,   opacity: 0.16, scale: 0.9 },
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
  // Path is wider than the viewport (1600 vs 1000 viewBox) so that when
  // we translateX it horizontally for the drift animation, no edge gap
  // appears. The closed shape (L 1600 200 L 0 200 Z) fills below the
  // wave so each band reads as a soft translucent layer.
  const path = `M 0 100 C 200 ${100 - amp}, 400 ${100 + amp}, 800 100 S 1400 ${100 - amp}, 1600 100 L 1600 200 L 0 200 Z`;
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
        viewBox="0 0 1600 200"
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
