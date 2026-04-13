// Minimal i18n helper with simple translation table for parent-facing messages.
type Locale = 'en' | 'hi'

const translations: Record<Locale, Record<string, string>> = {
	en: {
		'inactivity.subject': "{{studentName}} hasn't been active recently -- a quick nudge can help",
		'inactivity.body_html': '<p>Hi {{parentName}},</p><p>We noticed {{studentName}} hasn\'t studied in the last {{days}} days. A short 10-15 minute activity can help them get back on track. <a href="{{deepLink}}">Open their next session</a></p>',
		'digest.subject': 'Weekly Learning Summary - Spinzy Academy',
		'digest.fallback_text': 'Weekly Learning Summary for your children on Spinzy Academy.',
	},
	hi: {
		'inactivity.subject': '{{studentName}} हाल ही में सक्रिय नहीं रहा -- एक छोटा सा नudge मदद कर सकता है',
		'inactivity.body_html': '<p>नमस्ते {{parentName}},</p><p>हमने देखा कि {{studentName}} पिछले {{days}} दिनों से पढ़ाई नहीं कर रहा है। 10-15 मिनट की छोटी गतिविधि उसे ट्रैक पर वापस ला सकती है। <a href="{{deepLink}}">उनका अगला सत्र खोलें</a></p>',
		'digest.subject': 'साप्ताहिक अध्ययन सारांश - Spinzy Academy',
		'digest.fallback_text': 'आपके बच्चों के लिए साप्ताहिक अध्ययन सारांश।',
	},
}

export function t(key: string, vars?: Record<string, any>, locale?: string) {
	const loc = (locale as Locale) || 'en';
	const dict = translations[loc] ?? translations.en;
	let template = dict[key] ?? key;
	if (!vars) return template;
	return Object.keys(vars).reduce((s, k) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(vars[k])), template);
}

export const supportedLocales = Object.keys(translations) as Locale[];
