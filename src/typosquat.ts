/**
 * Bounded Levenshtein distance. Returns Infinity when the distance
 * exceeds `max`, letting callers early-exit cheaply.
 */
export function levenshtein(a: string, b: string, max: number): number {
	if (a === b) return 0
	if (Math.abs(a.length - b.length) > max) return Infinity
	const m = a.length
	const n = b.length
	if (m === 0) return n <= max ? n : Infinity
	if (n === 0) return m <= max ? m : Infinity
	let prev: number[] = new Array(n + 1)
	let curr: number[] = new Array(n + 1)
	for (let j = 0; j <= n; j++) prev[j] = j
	for (let i = 1; i <= m; i++) {
		curr[0] = i
		let rowMin = curr[0]
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
			if (curr[j] < rowMin) rowMin = curr[j]
		}
		if (rowMin > max) return Infinity
		;[prev, curr] = [curr, prev]
	}
	return prev[n] <= max ? prev[n] : Infinity
}

export type NearMatch = {
	name: string
	distance: number
}

/**
 * Distance budget by name length. Short names produce meaningless
 * proximity noise, so they are excluded entirely.
 */
export function maxDistanceForLength(length: number): number {
	if (length < 5) return 0
	if (length <= 7) return 1
	return 2
}

/**
 * Find known-bad names that are suspiciously close to `candidate`.
 * Exact matches are excluded — those are real matches, not typosquats.
 * Case-insensitive.
 */
export function findNearMatches(
	candidate: string,
	knownNames: Iterable<string>,
): NearMatch[] {
	const c = candidate.toLowerCase()
	const results: NearMatch[] = []
	for (const known of knownNames) {
		const k = known.toLowerCase()
		if (k === c) continue
		const max = maxDistanceForLength(Math.max(k.length, c.length))
		if (max === 0) continue
		const d = levenshtein(c, k, max)
		if (d !== Infinity && d >= 1 && d <= max) {
			results.push({ name: known, distance: d })
		}
	}
	return results.sort((x, y) => x.distance - y.distance)
}
