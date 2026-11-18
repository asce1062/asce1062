/**
 * Publication date guard for the content schema.
 *
 * Frontmatter dates are calendar dates, parsed as midnight UTC. A post dated
 * "today" by an author east of UTC is therefore still in the future for a UTC
 * build machine until their local date has begun in UTC. The furthest-ahead
 * time zone is UTC+14, so a date counts as future only when that calendar day
 * has not started anywhere yet. Real typos (next week, next year) still fail.
 */
const MAX_UTC_OFFSET_MS = 14 * 60 * 60 * 1000;

/** True when `date` has begun somewhere on Earth as of `now`. */
export function hasDateBegun(date: Date, now: Date = new Date()): boolean {
	return date.getTime() <= now.getTime() + MAX_UTC_OFFSET_MS;
}
