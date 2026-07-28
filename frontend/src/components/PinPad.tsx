"use client";

import { useState, useEffect } from "react";

interface PinPadProps {
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  error?: string;
}

export function PinPad({ onSubmit, onCancel, error }: PinPadProps) {
  const [digits, setDigits] = useState<string[]>([]);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (digits.length === 4) {
      onSubmit(digits.join(""));
    }
  }, [digits, onSubmit]);

  // Reset digits when error changes (allow retry)
  useEffect(() => {
    if (error) {
      setDigits([]);
    }
  }, [error]);

  function handleDigit(d: string) {
    if (digits.length < 4) {
      setDigits((prev) => [...prev, d]);
    }
  }

  function handleBackspace() {
    setDigits((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setDigits([]);
  }

  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["clear", "0", "backspace"],
  ];

  return (
    <div className="flex flex-col items-center gap-7">
      {/* 4-dot indicator */}
      <div className="flex gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
              i < digits.length
                ? "bg-[#861A22] dot-filled"
                : "bg-[#E5E7EB]"
            }`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-red-500 text-sm font-medium text-center -mt-2">{error}</p>
      )}

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-3.5">
        {keys.flat().map((key, idx) => {
          if (key === "clear") {
            return (
              <button
                key={idx}
                onClick={handleClear}
                className="h-16 w-16 rounded-2xl bg-[#F3F4F6] text-[#6B7280] text-sm font-medium active:scale-90 active:bg-[#E5E7EB] transition-all touch-manipulation"
              >
                Clear
              </button>
            );
          }
          if (key === "backspace") {
            return (
              <button
                key={idx}
                onClick={handleBackspace}
                className="h-16 w-16 rounded-2xl bg-[#F3F4F6] text-[#6B7280] text-xl active:scale-90 active:bg-[#E5E7EB] transition-all touch-manipulation flex items-center justify-center"
                aria-label="Borrar"
              >
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <line x1="18" y1="9" x2="12" y2="15" />
                  <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
              </button>
            );
          }
          return (
            <button
              key={idx}
              onClick={() => handleDigit(key)}
              disabled={digits.length >= 4}
              className="h-16 w-16 rounded-2xl bg-white text-[#1A1A1A] text-2xl font-medium shadow-[0_1px_3px_rgba(0,0,0,0.08)] active:scale-90 active:bg-[#F9FAFB] transition-all touch-manipulation disabled:opacity-30"
            >
              {key}
            </button>
          );
        })}
      </div>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="text-sm text-[#6B7280] font-medium hover:text-[#861A22] transition-colors mt-1"
      >
        Cancelar
      </button>
    </div>
  );
}
