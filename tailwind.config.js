/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0e1016',
        foreground: '#eef0f6',
        card: {
          DEFAULT: '#161922',
          foreground: '#eef0f6',
        },
        popover: {
          DEFAULT: '#12151d',
          foreground: '#eef0f6',
        },
        primary: {
          DEFAULT: '#16a34a',
          foreground: '#f0fdf4',
        },
        secondary: {
          DEFAULT: '#1e2230',
          foreground: '#c8cdd8',
        },
        muted: {
          DEFAULT: '#1a1e28',
          foreground: '#9aa3b5',
        },
        accent: {
          DEFAULT: '#222736',
          foreground: '#e2e6ef',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#fef2f2',
        },
        border: '#2a3040',
        input: '#1a1e28',
        ring: '#16a34a',
        sidebar: {
          DEFAULT: '#0a0c10',
          foreground: '#c8cdd8',
          primary: '#4ade80',
          'primary-foreground': '#f0fdf4',
          accent: '#181c26',
          'accent-foreground': '#eef0f6',
          border: '#1e2230',
          ring: '#16a34a',
        },
        chart: {
          1: '#16a34a',
          2: '#34d399',
          3: '#fbbf24',
          4: '#c084fc',
          5: '#ef4444',
        },
        success: '#34d399',
        warning: '#fbbf24',
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
        xl: 'calc(0.5rem + 6px)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
