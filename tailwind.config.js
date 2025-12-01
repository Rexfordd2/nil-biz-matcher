/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{ts,tsx}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				// Light theme palette
				background: '#F2E8D5', // parchment
				surface: '#FFFFFF', // cards/surfaces
				border: '#E5DEC9', // soft border
				mid: '#F7F1E3', // subtle surface
				foreground: '#0D2C3A', // navy text
				brand: {
					// Keep existing keys for compatibility with classnames
					red: '#0D2C3A', // alias to navy
					redGlow: '#C89A3C', // alias to gold
					navy: '#0D2C3A',
					gold: '#C89A3C'
				},
				fit: {
					perfect: '#16a34a',
					good: '#3b82f6',
					stretch: '#f59e0b',
					poor: '#9ca3af'
				}
			},
			boxShadow: {
				// subtle navy/gold glow
				glow: '0 0 0 2px rgba(200, 154, 60, 0.45), 0 0 20px rgba(13, 44, 58, 0.30)'
			}
		}
	},
	plugins: []
}


