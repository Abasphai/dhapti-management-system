/** Deterministic mock QR pattern (no external QR library). */
export function MockQrCode({
  value,
  size = 88,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const cells = 21;
  const cell = size / cells;
  const modules: boolean[][] = [];

  let seed = 0;
  for (let i = 0; i < value.length; i++) {
    seed = (seed * 31 + value.charCodeAt(i)) >>> 0;
  }

  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let y = 0; y < cells; y++) {
    modules[y] = [];
    for (let x = 0; x < cells; x++) {
      const inFinder =
        (x < 7 && y < 7) ||
        (x >= cells - 7 && y < 7) ||
        (x < 7 && y >= cells - 7);
      if (inFinder) {
        const lx = x % (cells - 7) < 7 ? x : x - (cells - 7);
        const ly = y % (cells - 7) < 7 ? y : y - (cells - 7);
        const ring =
          lx === 0 ||
          ly === 0 ||
          lx === 6 ||
          ly === 6 ||
          (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
        modules[y][x] = ring;
      } else {
        modules[y][x] = next() > 0.45;
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`QR code for ${value}`}
    >
      <rect width={size} height={size} fill="#fff" />
      {modules.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect
              key={`${x}-${y}`}
              x={x * cell}
              y={y * cell}
              width={cell}
              height={cell}
              fill="#002147"
            />
          ) : null
        )
      )}
    </svg>
  );
}
