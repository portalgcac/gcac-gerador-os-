/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:    '#1B6FBF',
          'blue-dark': '#134f8a',
          'blue-light': '#2d8de0',
          green:   '#6DBE45',
          'green-dark': '#4e9931',
          'green-light': '#89d662',
          metal:   '#8A8A8A',
          'metal-light': '#b0b0b0',
          dark:    '#0D0D0D',
          'dark-2': '#161616',
          'dark-3': '#1e1e1e',
          'dark-4': '#252525',
          'dark-5': '#2e2e2e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(109,190,69,0.15)',
        'glow-blue': '0 0 20px rgba(27,111,191,0.2)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleUp: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-right': 'slideRight 0.25s ease-out',
        'scale-up': 'scaleUp 0.3s cubic-bezier(0.11, 0, 0.5, 0)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
