'use client';

import { useState, type ReactNode } from 'react';

export function AnimatedSelect({
  value,
  onChange,
  children,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`animated-select${isOpen ? ' is-open' : ''}`}>
      <select
        className="form-select"
        value={value}
        disabled={disabled}
        aria-expanded={isOpen}
        onMouseDown={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) setIsOpen(true);
          if (event.key === 'Escape') setIsOpen(false);
        }}
        onBlur={() => setIsOpen(false)}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(false);
        }}
      >
        {children}
      </select>
      <span className="animated-select-arrow" aria-hidden="true" />
    </div>
  );
}
