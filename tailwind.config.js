/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        background: '#05050A', // Deep dark background
        surface: '#0A0A0F', // Slightly lighter for surfaces
        glass: {
          100: 'rgba(255, 255, 255, 0.02)',
          200: 'rgba(255, 255, 255, 0.05)',
          300: 'rgba(255, 255, 255, 0.08)',
        },
        primary: {
          DEFAULT: '#8B5CF6', // Violet
          dark: '#6D28D9',
          glow: 'rgba(139, 92, 246, 0.5)',
        },
        accent: {
          DEFAULT: '#22D3EE', // Cyan
          dark: '#0891B2',
          glow: 'rgba(34, 211, 238, 0.5)',
        }
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
        'glow-primary': 'radial-gradient(circle at center, rgba(139,92,246,0.15) 0%, transparent 70%)',
        'glow-accent': 'radial-gradient(circle at center, rgba(34,211,238,0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-hover': '0 8px 32px 0 rgba(139, 92, 246, 0.15)',
      },
    },
  },
  plugins: [],
}
