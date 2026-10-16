'use client';

import { useEffect, useRef, useState } from 'react';

export default function SearchBar({ value, onChange, placeholder = 'Search by customer, order or reference…' }) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (e) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 400);
  };

  const handleClear = () => {
    setLocal('');
    clearTimeout(timerRef.current);
    onChange('');
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="relative flex-1 min-w-0">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
        style={{ color: 'var(--muted)' }}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        className="input pl-10 pr-8"
        placeholder={placeholder}
        value={local}
        onChange={handleChange}
        id="search-input"
      />
      {local && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm"
          style={{ color: 'var(--muted)' }}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
