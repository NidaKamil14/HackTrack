/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        background: '#070B14', // Deep near-black navy
        surface: '#0F1B2D', // Dark navy blue
        elevated: '#111E31',
        input: '#0B1422',
        navy: {
          950: '#070B14',
          900: '#0F1B2D',
          850: '#111E31',
          800: '#0B1422',
          700: '#25364D',
        },
        border: {
          DEFAULT: '#25364D',
          navy: '#25364D',
        },
        glass: {
          100: 'rgba(255, 255, 255, 0.02)',
          200: 'rgba(255, 255, 255, 0.05)',
          300: 'rgba(255, 255, 255, 0.08)',
        },
        primary: {
          DEFAULT: '#104E66', // Deep teal-blue
          dark: '#0D4257',
          hover: '#156382',
          glow: 'rgba(53, 200, 232, 0.3)',
        },
        accent: {
          DEFAULT: '#35C8E8', // Cyan accent
          dark: '#0891B2',
          glow: 'rgba(53, 200, 232, 0.5)',
        },
        electric: {
          DEFAULT: '#2878F0', // Electric blue
          blue: '#2878F0',
        },
        slate: {
          text: '#F1F5F9',
          subtext: '#9AAAC0',
          mutedtext: '#71839B',
        }
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
        'glow-primary': 'radial-gradient(circle at center, rgba(53,200,232,0.12) 0%, transparent 70%)',
        'glow-accent': 'radial-gradient(circle at center, rgba(40,120,240,0.12) 0%, transparent 70%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-hover': '0 8px 32px 0 rgba(53, 200, 232, 0.15)',
      },
    },
  },
  plugins: [],
}
