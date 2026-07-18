import React from 'react';

export default function BrightHoneyBg() {
  return (
    <div className="amber-nectar-bg" aria-hidden="true">
      <div className="honey-ripple-center top-left-center">
        <span className="honey-ripple" style={{ animationDelay: '0s' }} />
        <span className="honey-ripple" style={{ animationDelay: '3.5s' }} />
        <span className="honey-ripple" style={{ animationDelay: '7s' }} />
      </div>
      <div className="honey-ripple-center bottom-right-center">
        <span className="honey-ripple" style={{ animationDelay: '1.75s' }} />
        <span className="honey-ripple" style={{ animationDelay: '5.25s' }} />
        <span className="honey-ripple" style={{ animationDelay: '8.75s' }} />
      </div>
    </div>
  );
}
