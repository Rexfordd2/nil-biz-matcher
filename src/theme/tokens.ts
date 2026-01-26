export type ColorTokens = {
	background: string
	surface: string
	border: string
	mid: string
	brandPrimary: string
	brandPrimaryGlow: string
	fitPerfect: string
	fitGood: string
	fitStretch: string
	fitPoor: string
}

export type RadiusTokens = {
	sm: number
	md: number
	lg: number
	xl: number
}

export type SpacingScale = {
	xs: number
	sm: number
	md: number
	lg: number
	xl: number
	'2xl': number
}

export type FontTokens = {
	familyBase: string
	familyHeading: string
	weightMedium: number
	weightSemibold: number
	weightBold: number
}

export type ThemeTokens = {
	colors: ColorTokens
	radius: RadiusTokens
	spacing: SpacingScale
	fonts: FontTokens
}

export const defaultThemeTokens: ThemeTokens = {
	colors: {
		background: '#0a0a0a',
		surface: '#111111',
		border: '#1f1f1f',
		mid: '#222222',
		brandPrimary: '#e50914',
		brandPrimaryGlow: '#ff1a1a',
		fitPerfect: '#16a34a',
		fitGood: '#3b82f6',
		fitStretch: '#f59e0b',
		fitPoor: '#9ca3af'
	},
	radius: {
		sm: 6,
		md: 10,
		lg: 14,
		xl: 20
	},
	spacing: {
		xs: 4,
		sm: 8,
		md: 12,
		lg: 16,
		xl: 24,
		'2xl': 32
	},
	fonts: {
		familyBase: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif',
		familyHeading: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif',
		weightMedium: 500,
		weightSemibold: 600,
		weightBold: 800
	}
}

export function getCurrentThemeTokens(): ThemeTokens {
	return defaultThemeTokens
}

export function toCssVariables(tokens: ThemeTokens): Record<string, string> {
	return {
		'--color-background': tokens.colors.background,
		'--color-surface': tokens.colors.surface,
		'--color-border': tokens.colors.border,
		'--color-mid': tokens.colors.mid,
		'--color-brand-primary': tokens.colors.brandPrimary,
		'--color-brand-primary-glow': tokens.colors.brandPrimaryGlow,
		'--color-fit-perfect': tokens.colors.fitPerfect,
		'--color-fit-good': tokens.colors.fitGood,
		'--color-fit-stretch': tokens.colors.fitStretch,
		'--color-fit-poor': tokens.colors.fitPoor,
		'--radius-sm': `${tokens.radius.sm}px`,
		'--radius-md': `${tokens.radius.md}px`,
		'--radius-lg': `${tokens.radius.lg}px`,
		'--radius-xl': `${tokens.radius.xl}px`,
		'--space-xs': `${tokens.spacing.xs}px`,
		'--space-sm': `${tokens.spacing.sm}px`,
		'--space-md': `${tokens.spacing.md}px`,
		'--space-lg': `${tokens.spacing.lg}px`,
		'--space-xl': `${tokens.spacing.xl}px`,
		'--space-2xl': `${tokens.spacing['2xl']}px`,
		'--font-family-base': tokens.fonts.familyBase,
		'--font-family-heading': tokens.fonts.familyHeading,
		'--font-weight-medium': `${tokens.fonts.weightMedium}`,
		'--font-weight-semibold': `${tokens.fonts.weightSemibold}`,
		'--font-weight-bold': `${tokens.fonts.weightBold}`
	}
}


