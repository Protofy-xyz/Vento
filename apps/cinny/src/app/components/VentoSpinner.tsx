import React from 'react';

// Spinner personalizado que usa colores de Tamagui directamente
// Evita el flash de colores de Folds durante la carga
export function VentoSpinner({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        animation: 'vento-spin 1s linear infinite',
      }}
    >
      <style>
        {`
          @keyframes vento-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="var(--color9, var(--color, #a78bfa))"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        opacity="0.8"
      />
    </svg>
  );
}

