/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_WORKFLOW_CLOUD_PERSISTENCE?: string
	readonly VITE_WORKFLOW_CLOUD_PERSISTENCE_MODE?: string
	readonly VITE_EXISTING_USER_LOGIN_ENABLED?: string
	readonly VITE_PUBLIC_MODE?: string
	readonly VITE_APP_MODE?: string
	readonly VITE_SUPABASE_URL?: string
	readonly VITE_SUPABASE_ANON_KEY?: string
	readonly VITE_E2E_BYPASS_AUTH?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
