// Minimal i18n placeholder
export function t(key: string, vars?: Record<string, any>) {
	if (!vars) return key;
	return Object.keys(vars).reduce((s, k) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(vars[k])), key);
}

export const supportedLocales = ['en'];
