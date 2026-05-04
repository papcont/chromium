/**
 * Shared Tailwind CSS preset for Nexus engineering apps.
 * Used by: CADAM, Pascal Editor, PLM Extensions.
 *
 * Usage in each app's tailwind.config.js:
 *   const nexusPreset = require('/nexus/src/design-tokens/tailwind.preset.js');
 *   module.exports = { presets: [nexusPreset], content: [...] };
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Nexus dark engineering palette
        nexus: {
          bg:          '#09090b',
          surface:     '#18181b',
          'surface-2': '#27272a',
          border:      '#3f3f46',
          text:        '#fafafa',
          muted:       '#71717a',
          accent:      '#3b82f6',
          'accent-dim':'rgba(59,130,246,0.15)',
          success:     '#22c55e',
          warning:     '#f59e0b',
          error:       '#ef4444',
          // CAD-specific
          'cad-blue':  '#60a5fa',
          'cad-green': '#4ade80',
          'cad-orange':'#fb923c',
        },
        // PLM status colours (Fusion Manage convention)
        plm: {
          draft:     '#71717a',
          review:    '#f59e0b',
          approved:  '#22c55e',
          released:  '#3b82f6',
          obsolete:  '#ef4444',
        },
      },
      fontFamily: {
        mono: ['Geist Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        nexus: '10px',
      },
      boxShadow: {
        'nexus-card':  '0 1px 3px 0 rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        'nexus-panel': '4px 0 24px 0 rgba(0,0,0,0.5)',
      },
      keyframes: {
        'nexus-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
      animation: {
        'nexus-pulse': 'nexus-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
