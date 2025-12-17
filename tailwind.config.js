/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{ts,tsx}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				// Unified light theme palette (high-contrast on light)
				background: '#f8fafc', // slate-50 page background
				surface: '#ffffff', // cards/surfaces
				border: '#e2e8f0', // slate-200 borders
				mid: '#f1f5f9', // slate-100 subtle surface
				foreground: '#0f172a', // slate-900 primary text
				brand: {
					// Keep existing keys for compatibility with classnames
					red: '#0f172a', // use slate-900 as "brand red" alias
					redGlow: '#334155', // slate-700 accent glow
					navy: '#0f172a',
					gold: '#334155'
				},
				fit: {
					perfect: '#16a34a',
					good: '#3b82f6',
					stretch: '#f59e0b',
					poor: '#9ca3af'
				}
			},
			boxShadow: {
				// subtle neutral glow suitable for light theme
				glow: '0 0 0 2px rgba(51, 65, 85, 0.25), 0 0 16px rgba(15, 23, 42, 0.12)'
			}
		}
	},
	plugins: []
}


