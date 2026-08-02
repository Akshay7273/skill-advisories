import * as z from "zod/v4"

/**
 * One independently verifiable downstream integration.
 *
 * The fields are chosen so that nothing here can be asserted without somewhere
 * to check it. `url` points at the integration itself rather than at a project
 * homepage, and `consent_url` points at the place the adopter agreed to be
 * listed. A reader who trusts neither this project nor the adopter can follow
 * both links and decide for themselves.
 *
 * There is deliberately no download count, dependent count, or star count. Those
 * are measured separately in `metrics/history.json`, and keeping them out of this
 * file means the adoption question can never be quietly answered with traffic.
 */
export const AdopterSchema = z
  .object({
    name: z.string().min(1),
    url: z.string().regex(/^https:\/\//),
    integration: z.enum(["cli", "action", "mcp", "feed", "library"]),
    consent: z.enum(["public-link", "maintainer-stated"]),
    consent_url: z.string().regex(/^https:\/\//).optional(),
    recorded: z.string().min(1),
    verified: z.boolean(),
    notes: z.string().optional(),
  })
  .strict()

export const AdoptersSchema = z
  .object({
    $schema: z.string().url().optional(),
    schema_version: z.literal("1"),
    entries: z.array(AdopterSchema),
  })
  .strict()

export type Adopter = z.infer<typeof AdopterSchema>
export type Adopters = z.infer<typeof AdoptersSchema>

export const ADOPTERS_FILE_NAME = "adopters.json"

/**
 * Read the ledger, refusing one that lists the same integration URL twice.
 *
 * One project legitimately appears more than once -- a repository can use the
 * Action in CI and the MCP server locally -- so the name is not the identity.
 * The same URL twice is either a duplicate or two entries disagreeing about one
 * integration, and a ledger whose count depends on which of them is read has
 * not answered the question it exists to answer.
 */
export function parseAdopters(input: unknown): Adopters {
  const adopters = AdoptersSchema.parse(input)
  const seen = new Set<string>()
  for (const entry of adopters.entries) {
    if (seen.has(entry.url)) {
      throw new Error(`adoption ledger lists ${entry.url} more than once`)
    }
    seen.add(entry.url)
  }
  return adopters
}

/**
 * The entries that count towards the v0.6 adoption gate.
 *
 * Two conditions, both required. `verified` is a maintainer saying they
 * followed the links and the integration was real and current -- an entry can
 * sit in the file unverified for as long as that takes, and contributes
 * nothing meanwhile. `consent_url` is the public evidence of consent, and
 * without it a listing is this project's word about somebody else's project.
 *
 * The gate is deliberately a filter over recorded evidence rather than a
 * boolean somebody sets. There is no way to satisfy it except by adding an
 * entry whose links a reader can follow.
 */
export function verifiedAdopters(adopters: Adopters): Adopter[] {
  return adopters.entries.filter((entry) => entry.verified && entry.consent_url !== undefined)
}

/**
 * Whether the ROADMAP v0.6 adoption gate is met: at least one independently
 * verifiable downstream integration or pilot.
 */
export function adoptionGateMet(adopters: Adopters): boolean {
  return verifiedAdopters(adopters).length > 0
}
