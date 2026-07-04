import type { Config } from 'tailwindcss';

export default {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        psf: {
          blue: '#0A84FF',
          background: '#F5F6F8',
          surface: '#FFFFFF',
          muted: '#9CA3AF',
          text: '#0B0B0F',
          secondary: '#6B7280',
          success: '#34C759',
          warning: '#FF9F0A',
          danger: '#FF3B30',
          gold: '#FFD60A',
        },
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;
