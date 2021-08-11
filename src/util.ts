//** FUNCTIONS

export function songNamePredicate(name: string): string | void {
	if (/\.(mp3|aac)$/i.test(name)) {
		return 'audio/mpeg'
	}
	if (/\.flac$/i.test(name)) {
		return 'audio/flac'
	}
}

const collator = new Intl.Collator("en", { localeMatcher: 'lookup', usage: 'sort', sensitivity: 'variant' });
export function songNameComparator(a: string, b: string): number {
	return collator.compare(a, b);
}


