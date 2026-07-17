/* Global mosaic-tiles background overlay.
 *
 * Renders a fixed, pointer-events-none grid of subtle accent tiles behind
 * all app content. Visible only when the `mosaic` theme is active on
 * <html>. Each tile breathes individually via a CSS keyframe animation
 * with a per-tile staggered delay, producing a slow organic shimmer
 * that fits the theme name.
 *
 * Layout: CSS grid capped at 10 columns on wide screens, scaling down
 * responsively to 8 / 6 / 4 columns. Tiles fill the viewport row-by-row
 * (80 tiles total = enough rows for tall viewports at 10 cols).
 */

const TILE_COUNT = 80;

// Pre-compute staggered animation delays so each tile breathes out of
// phase with its neighbours. Uses a pseudo-randomised but stable
// distribution derived from the tile index — deterministic across renders
// so the pattern doesn't shift on re-mount.
function delayFor(index: number, cols: number): number {
  const row = Math.floor(index / cols);
  const col = index % cols;
  // Combine row + col into a stable phase offset, then mod it into a
  // 0-8s window. 8s spread over a 14s animation keeps the breathing
  // clearly out of sync without feeling chaotic.
  const offset = (row * 1.3 + col * 0.7) % 8;
  return Number(offset.toFixed(2));
}

// Animation duration per tile — slightly varied so the breathing never
// fully syncs across the grid even after many cycles.
function durationFor(index: number): number {
  return 13 + (index % 5); // 13s..17s
}

export default function MosaicTilesBg() {
  return (
    <div className="mosaic-tiles-bg" aria-hidden="true">
      {Array.from({ length: TILE_COUNT }, (_, i) => (
        <span
          key={i}
          className="mosaic-tile"
          style={{
            animationDelay: `${delayFor(i, 10)}s`,
            animationDuration: `${durationFor(i)}s`,
          }}
        />
      ))}
    </div>
  );
}
