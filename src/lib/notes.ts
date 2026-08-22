/** Parse `2026-08-22T21-45-slug` note ids into a Date (ids may be lowercased). */
export const parseNoteTimestamp = (id: string): Date => {
	const match = id.match(/^(\d{4})-(\d{2})-(\d{2})[tT](\d{2})-(\d{2})(?:-|$)/);
	if (!match) {
		throw new Error(
			`Note filename must start with YYYY-MM-DDTHH-mm (got "${id}")`,
		);
	}

	const [, year, month, day, hour, minute] = match;
	return new Date(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour),
		Number(minute),
	);
};

export const formatNoteTimestamp = (date: Date) =>
	date.toLocaleString('en-us', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
