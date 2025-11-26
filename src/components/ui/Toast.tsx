import { createContext, PropsWithChildren, useCallback, useContext, useState } from 'react'
import { clsx } from 'clsx'

type Toast = { id: number; message: string }
type Ctx = { show: (message: string) => void }

const ToastCtx = createContext<Ctx>({ show: () => {} })

export function useToast() {
	return useContext(ToastCtx)
}

export function ToastProvider({ children }: PropsWithChildren) {
	const [toasts, setToasts] = useState<Toast[]>([])
	const show = useCallback((message: string) => {
		const id = Date.now()
		setToasts(t => [...t, { id, message }])
		setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2200)
	}, [])
	return (
		<ToastCtx.Provider value={{ show }}>
			{children}
			<div className="fixed bottom-4 right-4 flex flex-col gap-2">
				{toasts.map(t => (
					<div
						key={t.id}
						className={clsx(
							'card fade-in px-4 py-3 text-sm bg-mid border-brand-red/40',
							'shadow-glow text-white'
						)}
					>
						{t.message}
					</div>
				))}
			</div>
		</ToastCtx.Provider>
	)
}


