import React from 'react';

const FIREFLY_COUNT = 12;

export default function DarkGreenBg() {
  return (
    <div className="emerald-dusk-bg" aria-hidden="true">
      {Array.from({ length: FIREFLY_COUNT }, (_, i) => {
        const x = (i * 17 + 10) % 90; // Stagger horizontally
        const y = (i * 23 + 20) % 80 + 10; // Stagger vertically
        const size = 4 + (i % 3) * 3; // 4px to 10px
        const delay = -((i * 2.7) % 12);
        const duration = 14 + (i % 4) * 4; // 14s to 26s

        return (
          <span
            key={i}
            className="emerald-firefly"
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
