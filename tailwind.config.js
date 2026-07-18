/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        border: 'hsl(var(--border-hsl))',
        input: 'hsl(var(--border-hsl))',
        ring: 'hsl(var(--accent-hsl))',
        background: 'hsl(var(--bg-hsl))',
        foreground: 'hsl(var(--text-hsl))',
        primary: {
          DEFAULT: 'hsl(var(--accent-hsl))',
          foreground: 'hsl(var(--text-hsl))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--surface-hsl))',
          foreground: 'hsl(var(--text-hsl))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--error-hsl))',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'hsl(var(--surface-hsl))',
          foreground: 'hsl(var(--text-dim-hsl))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent-hsl))',
          foreground: 'hsl(var(--text-hsl))',
        },
        popover: {
          DEFAULT: 'hsl(var(--surface-hsl))',
          foreground: 'hsl(var(--text-hsl))',
        },
        card: {
          DEFAULT: 'hsl(var(--surface-hsl))',
          foreground: 'hsl(var(--text-hsl))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
