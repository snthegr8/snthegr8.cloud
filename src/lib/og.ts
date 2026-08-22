export const formatOgDate = (date: Date) =>
	date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});

export const OG_BG = './public/images/meta-bg.png';

export const OG_FONTS = [
	'./src/assets/fonts/libre-baskerville-700.ttf',
	'./src/assets/fonts/libre-baskerville-400-italic.ttf',
];

/** Shared card look: meta-bg + cream serif type */
export const ogCardOptions = (title: string, description: string) => ({
	title,
	description,
	bgImage: {
		path: OG_BG,
		fit: 'cover' as const,
	},
	fonts: OG_FONTS,
	font: {
		title: {
			families: ['Libre Baskerville'],
			weight: 'Bold' as const,
			color: [236, 223, 204] as [number, number, number],
			size: 64,
			lineHeight: 1.15,
		},
		description: {
			families: ['Libre Baskerville'],
			weight: 'Normal' as const,
			color: [168, 160, 148] as [number, number, number],
			size: 28,
			lineHeight: 1.4,
		},
	},
	padding: 80,
});
