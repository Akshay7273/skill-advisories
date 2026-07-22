import { describe, expect, it } from "vitest"
import {
	findNearMatches,
	levenshtein,
	maxDistanceForLength,
} from "../src/typosquat.js"

describe("levenshtein", () => {
	it("returns 0 for identical strings", () => {
		expect(levenshtein("omnicogg", "omnicogg", 2)).toBe(0)
	})
	it("counts single edits", () => {
		expect(levenshtein("omnicog", "omnicogg", 2)).toBe(1)
	})
	it("returns Infinity beyond the cap", () => {
		expect(levenshtein("abcdef", "zzzzzz", 2)).toBe(Infinity)
	})
})

describe("maxDistanceForLength", () => {
	it("disables proximity for short names", () => {
		expect(maxDistanceForLength(4)).toBe(0)
	})
	it("allows 1 edit for medium names", () => {
		expect(maxDistanceForLength(7)).toBe(1)
	})
	it("allows 2 edits for long names", () => {
		expect(maxDistanceForLength(12)).toBe(2)
	})
})

describe("findNearMatches", () => {
	it("flags a 1-edit variant", () => {
		expect(findNearMatches("omnicog", ["omnicogg"])).toEqual([
			{ name: "omnicogg", distance: 1 },
		])
	})
	it("ignores exact matches", () => {
		expect(findNearMatches("omnicogg", ["omnicogg"])).toEqual([])
	})
	it("ignores short names entirely", () => {
		expect(findNearMatches("abcd", ["abce"])).toEqual([])
	})
	it("is case-insensitive", () => {
		expect(findNearMatches("OMNICOG", ["omnicogg"])).toEqual([
			{ name: "omnicogg", distance: 1 },
		])
	})
})
