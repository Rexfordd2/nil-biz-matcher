import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import RootRouter from './routes/RootRouter'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { normalizeError } from './lib/normalizeError'
import { initAnonIdentity } from './lib/anonIdentity'

// Initialize anonymous identity at app start
initAnonIdentity()

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

let appMounted = false

window.addEventListener('error', (e) => {
	if (!appMounted) {
		showBootError(normalizeError((e as any)?.error || (e as any)?.message))
	} else {
		// eslint-disable-next-line no-console
		console.error('[window.error]', normalizeError((e as any)?.error || (e as any)?.message), e)
	}
})

window.addEventListener('unhandledrejection', (e) => {
	const reason = (e as any)?.reason
	if (!appMounted) {
		showBootError(normalizeError(reason))
	} else {
		// eslint-disable-next-line no-console
		console.error('[unhandledrejection]', normalizeError(reason), e)
	}
})

try {
	const rootNode = document.getElementById('root')
	if (!rootNode) {
		throw new Error('Root element #root not found')
	}
	const root = createRoot(rootNode)
	root.render(
		<StrictMode>
			<AuthProvider>
				<RootRouter />
			</AuthProvider>
		</StrictMode>
	)
	// Mark app as mounted only after successful render call
	appMounted = true
} catch (err) {
	// During boot, show a friendly error screen
	showBootError(normalizeError(err))
}


