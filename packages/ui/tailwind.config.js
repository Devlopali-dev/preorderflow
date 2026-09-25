/** @type {import('tailwindcss').Config} */
// ============================================================
//  JEFF'S DESIGN SYSTEM — tailwind.config.js
//  Étend Tailwind avec les tokens du design system
// ============================================================

const colors = {
  // Blue palette
  blue: {
    50:  '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  // Warm neutrals
  neutral: {
    0:   '#ffffff',
    50:  '#fafaf9',
    100: '#f5f5f4',
    200: '#e7e5e4',
    300: '#d6d3d1',
    400: '#a8a29e',
    500: '#78716c',
    600: '#57534e',
    700: '#44403c',
    800: '#292524',
    900: '#1c1917',
  },
}

module.exports = {
  content: [
    './src/**/*.{html,js,jsx,ts,tsx,vue,svelte}',
    './index.html',
    './public/**/*.html',
  ],

  // dark mode via classe ou attribut
  darkMode: ['class', '[data-theme="dark"]'],

  theme: {
    extend: {

      // ── Colors ──
      colors: {
        ...colors,
        primary: {
          DEFAULT:  colors.blue[600],
          hover:    colors.blue[700],
          subtle:   colors.blue[50],
          muted:    colors.blue[100],
          text:     colors.blue[700],
          // dark mode via CSS vars pour simplifier
        },
        surface:  colors.neutral[0],
        bg: {
          DEFAULT: colors.neutral[50],
          subtle:  colors.neutral[100],
          muted:   colors.neutral[200],
        },
      },

      // ── Typography ──
      fontFamily: {
        sans: [
          'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont',
          '"Segoe UI"', 'sans-serif'
        ],
        mono: [
          'ui-monospace', '"Cascadia Code"', '"Fira Code"', 'Consolas', 'monospace'
        ],
      },
      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1rem' }],
        sm:   ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem',     { lineHeight: '1.5rem' }],
        lg:   ['1.125rem', { lineHeight: '1.75rem' }],
        xl:   ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl':['1.5rem',   { lineHeight: '2rem' }],
        '3xl':['1.875rem', { lineHeight: '2.25rem' }],
        '4xl':['2.25rem',  { lineHeight: '2.5rem' }],
      },

      // ── Spacing (base 4px) ──
      spacing: {
        1:  '0.25rem',
        2:  '0.5rem',
        3:  '0.75rem',
        4:  '1rem',
        5:  '1.25rem',
        6:  '1.5rem',
        8:  '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
      },

      // ── Border radius ──
      borderRadius: {
        sm:   '0.25rem',
        md:   '0.375rem',
        lg:   '0.5rem',
        xl:   '0.75rem',
        '2xl':'1rem',
        full: '9999px',
      },

      // ── Shadows (warm) ──
      boxShadow: {
        xs: '0 1px 2px 0 rgba(28,25,23,.06)',
        sm: '0 1px 3px 0 rgba(28,25,23,.10), 0 1px 2px -1px rgba(28,25,23,.08)',
        md: '0 4px 6px -1px rgba(28,25,23,.10), 0 2px 4px -2px rgba(28,25,23,.08)',
        lg: '0 10px 15px -3px rgba(28,25,23,.10), 0 4px 6px -4px rgba(28,25,23,.08)',
        xl: '0 20px 25px -5px rgba(28,25,23,.12), 0 8px 10px -6px rgba(28,25,23,.08)',
      },

      // ── Transitions ──
      transitionDuration: {
        fast: '100ms',
        base: '150ms',
        slow: '250ms',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.34,1.56,.64,1)',
      },

      // ── Keyframes ──
      keyframes: {
        'fade-in':  { from:{ opacity:0 }, to:{ opacity:1 } },
        'slide-up': { from:{ opacity:0, transform:'translateY(12px)' }, to:{ opacity:1, transform:'none' } },
        'spin':     { to:{ transform:'rotate(360deg)' } },
      },
      animation: {
        'fade-in':  'fade-in 150ms ease-out',
        'slide-up': 'slide-up 250ms cubic-bezier(.34,1.56,.64,1)',
        'spin':     'spin .7s linear infinite',
      },
    },
  },

  plugins: [
    // Forms plugin recommandé : npm i -D @tailwindcss/forms
    // require('@tailwindcss/forms'),
  ],
}
