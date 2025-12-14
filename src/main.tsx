import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'

function showBootError(error: unknown) {
	const rootEl = document.getElementById('root')
	if (rootEl) {
		rootEl.innerHTML = `<div style="padding:16px;font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#B23A3A">
  <div style="font-weight:800;margin-bottom:8px">App failed to start</div>
  <pre style="white-space:pre-wrap;font-size:12px;background:#fff3f3;border:1px solid #ffc9c9;border-radius:8px;padding:10px;color:#7a1f1f;">${String(
		(error as any)?.stack || error
	)}</pre>
</div>`
	}
	// eslint-disable-next-line no-console
	console.error('Boot error:', error)
}

window.addEventListener('error', (e) => {
	showBootError(e.error || e.message)
})
window.addEventListener('unhandledrejection', (e) => {
	showBootError((e as any)?.reason || e)
})

try {
	const rootNode = document.getElementById('root')
	if (!rootNode) {
		throw new Error('Root element #root not found')
	}
	createRoot(rootNode).render(
		<StrictMode>
			<AuthProvider>
				<App />
			</AuthProvider>
		</StrictMode>
	)
} catch (err) {
	showBootError(err)
}


