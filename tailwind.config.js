/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{ts,tsx}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				background: '#0a0a0a',
				surface: '#111111',
				border: '#1f1f1f',
				mid: '#222222',
				brand: {
					red: '#e50914',
					redGlow: '#ff1a1a'
				},
				fit: {
					perfect: '#16a34a',
					good: '#3b82f6',
					stretch: '#f59e0b',
					poor: '#9ca3af'
				}
			},
			boxShadow: {
				glow: '0 0 0 2px rgba(229, 9, 20, 0.5), 0 0 20px rgba(229, 9, 20, 0.35)'
			}
		}
	},
	plugins: []
}


