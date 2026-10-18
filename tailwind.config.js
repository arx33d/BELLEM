/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gemini: {
          bg: '#131314',
          sidebar: '#1e1f20',
          surface: '#212225',
          card: '#1e1f20',
          hover: '#282a2c',
          border: '#333537',
          borderLight: '#444746',
          text: '#e3e3e3',
          textMuted: '#9aa0a6',
          textDim: '#757b80',
          blue: '#1a73e8',
          blueHover: '#1b66c9',
          blueLight: '#a8c7fa',
          purple: '#c58af9',
          gradientStart: '#4285f4',
          gradientMid: '#9b72cb',
          gradientEnd: '#d96570',
        }
      },
      fontFamily: {
        sans: [
          '"Google Sans"',
          '"Segoe UI"',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          'Consolas',
          'Monaco',
          'monospace'
        ]
      },
      boxShadow: {
        'gemini': '0 4px 20px 0 rgba(0, 0, 0, 0.35)',
        'glow': '0 0 15px rgba(66, 133, 244, 0.25)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
