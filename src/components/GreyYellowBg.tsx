import React from 'react';

const DUST_COUNT = 15;

export default function GreyYellowBg() {
  return (
    <div className="ochre-sands-bg" aria-hidden="true">
      {Array.from({ length: DUST_COUNT }, (_, i) => {
        const x = (i * 13) % 100;
        const y = (i * 19 + 5) % 90;
        const size = 3 + (i % 3) * 2; // 3px to 7px
        const delay = -((i * 1.9) % 10);
        const duration = 18 + (i % 5) * 4; // 18s..34s

        return (
          <span
            key={i}
            className="ochre-dust-particle"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${size}px`,
              height: `${size}px`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
          />
        );
      })}
    </div>
  );
}
