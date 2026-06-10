/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0a0a0f',
        surface:  '#13131a',
        surface2: '#1c1c28',
        accent:   '#7c4dff',
        danger:   '#ff4d6d',
        safe:     '#00e676',
        warn:     '#ffab40',
        vitima:   '#ff6b9d',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'pulse-danger': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,77,109,0.5)' },
          '50%':       { boxShadow: '0 0 0 18px rgba(255,77,109,0)' },
        },
      },
      animation: {
        'pulse-danger': 'pulse-danger 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
