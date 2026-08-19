export type ExperienceEntry = {
	period: string;
	company: string;
	role: string;
	summary?: string;
	skills?: string[];
};

export const experience: ExperienceEntry[] = [
	{
		period: 'Jan 2026 – Present',
		company: 'Anamenng',
		role: 'Fullstack Engineer',
	},
	{
		period: 'Jun 2025 – Dec 2025',
		company: 'Anamenng',
		role: 'Backend Engineer',
	},
	{
		period: 'May 2025 – May 2026',
		company: 'Nowpost',
		role: 'Frontend Engineer',
	},
	{
		period: 'Sept 2024 – Jun 2025',
		company: 'GrowthApp (Remote)',
		role: 'Full Stack Engineer',
		summary:
			'Fullstack ownership across Next.js, Langchain, and PostgreSQL, plus monitoring with the LGTM stack. Worked with OpenAI models for data processing, Redis for caching and queues, Cloudflare Workers with HonoJS, TypeScript, GitHub Actions, and GCP. Maintained clean hexagonal architecture and managed core packages for consistency and performance.',
		skills: [
			'Next.js',
			'Langchain',
			'PostgreSQL',
			'LGTM',
			'OpenAI',
			'Redis',
			'Cloudflare Workers',
			'HonoJS',
			'TypeScript',
			'GitHub Actions',
			'GCP',
		],
	},
	{
		period: 'Mar 2024 – Sept 2024',
		company: 'Prime Innovation Of Technology',
		role: 'Instructor / Frontend Web Developer',
	},
];
