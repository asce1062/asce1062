/**
 * GitHub API utilities
 * Handles fetching and processing GitHub repository data
 *
 * Failure policy: these run at build time, and a failed request fails the
 * build so Netlify keeps serving the last good deploy. Pages never ship
 * empty or partial GitHub data. Transient failures (network errors, 5xx, rate
 * limits that say when to retry) are retried first.
 */

const MAX_ATTEMPTS = 3;
const MAX_RETRY_WAIT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait before a retry, or null when the response is not worth retrying. */
function retryDelay(response: Response, attempt: number): number | null {
	const retryAfter = Number(response.headers.get("Retry-After"));
	const backoff = 1000 * 2 ** (attempt - 1);
	if (response.status >= 500 || response.status === 429) {
		return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff;
	}
	// 403 is only transient as a secondary rate limit, which sends Retry-After.
	if (response.status === 403 && retryAfter > 0) return retryAfter * 1000;
	return null;
}

/**
 * Fetch a GitHub API URL, retrying transient failures. Throws when the request
 * still fails, naming the URL and status.
 */
async function githubFetch(url: string, headers: Record<string, string>): Promise<Response> {
	for (let attempt = 1; ; attempt++) {
		let response: Response;
		try {
			response = await fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
		} catch (error) {
			// Network errors and timeouts
			if (attempt >= MAX_ATTEMPTS) throw new Error(`GitHub API request failed: ${url}`, { cause: error });
			await sleep(1000 * 2 ** (attempt - 1));
			continue;
		}
		if (response.ok) return response;

		const delay = retryDelay(response, attempt);
		await response.body?.cancel();
		if (delay === null || attempt >= MAX_ATTEMPTS || delay > MAX_RETRY_WAIT_MS) {
			throw new Error(`GitHub API error: ${response.status} ${response.statusText} (${url})`);
		}
		await sleep(delay);
	}
}

/**
 * Get standard GitHub API headers
 */
function getGitHubHeaders(token?: string): Record<string, string> {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	};

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	return headers;
}

/**
 * Parse owner and repo from a GitHub repository URL.
 * Handles various URL formats including tree paths.
 */
export function getRepoSlugFromUrl(repoUrl: string): { owner: string; repo: string } | null {
	try {
		const url = new URL(repoUrl);
		const parts = url.pathname.split("/").filter(Boolean);

		if (parts.length >= 2) {
			return {
				owner: parts[0],
				repo: parts[1],
			};
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Get base GitHub repo URL from any GitHub URL
 */
export function getBaseRepoUrl(repoUrl: string): string | null {
	const slug = getRepoSlugFromUrl(repoUrl);
	if (!slug) return null;
	return `https://github.com/${slug.owner}/${slug.repo}`;
}

// =============================================================================
// REPOSITORY TYPES & FUNCTIONS
// =============================================================================

export interface GitHubRepo {
	name: string;
	description: string;
	html_url: string;
	homepage: string | null;
	stargazers_count: number;
	forks_count: number;
	open_issues_count: number;
	language: string | null;
	languages_url: string;
	fork: boolean;
	pushed_at: string;
	updated_at: string;
	languages?: string[]; // Will be populated after fetching
	contributors_count?: number; // Will be populated after fetching
}

/**
 * Fetch repositories from GitHub API with pagination
 */
export async function fetchGitHubRepos(username: string, token?: string): Promise<GitHubRepo[]> {
	const headers = getGitHubHeaders(token);
	let allRepos: GitHubRepo[] = [];
	let page = 1;
	let hasMore = true;

	// Fetch all pages
	while (hasMore) {
		const response = await githubFetch(
			`https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=pushed`,
			headers
		);
		const repos = await response.json();

		if (repos.length === 0) {
			hasMore = false;
		} else {
			allRepos = allRepos.concat(repos);
			page++;

			// Safety check: stop after 10 pages (1000 repos)
			if (page > 10) {
				hasMore = false;
			}
		}
	}

	return allRepos;
}

/**
 * Fetch contributors count for a repository
 */
async function fetchRepoContributorsCount(owner: string, repo: string, token?: string): Promise<number> {
	const response = await githubFetch(
		`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=1&anon=true`,
		getGitHubHeaders(token)
	);
	// 204: the repository is empty
	if (response.status === 204) return 0;

	// GitHub returns the total count in the Link header
	const linkHeader = response.headers.get("Link");
	if (linkHeader) {
		const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
		if (lastMatch) {
			return parseInt(lastMatch[1], 10);
		}
	}

	// If no Link header, count from response (only 1 page)
	const contributors = await response.json();
	return Array.isArray(contributors) ? contributors.length : 0;
}

/**
 * Fetch languages for a repository
 */
async function fetchRepoLanguages(languagesUrl: string, token?: string): Promise<string[]> {
	const response = await githubFetch(languagesUrl, getGitHubHeaders(token));
	// Returns object like { "TypeScript": 12345, "JavaScript": 6789 }
	// We just need the language names
	return Object.keys(await response.json());
}

/**
 * Extract owner from GitHub URL
 */
function extractOwnerFromUrl(htmlUrl: string): string {
	const parts = new URL(htmlUrl).pathname.split("/").filter(Boolean);
	return parts[0] || "";
}

/**
 * Enrich repositories with language and contributor data
 */
export async function enrichReposWithLanguages(
	repos: GitHubRepo[],
	token?: string,
	includeContributors: boolean = true
): Promise<GitHubRepo[]> {
	const enrichedRepos = await Promise.all(
		repos.map(async (repo) => {
			const owner = extractOwnerFromUrl(repo.html_url);
			const [languages, contributors_count] = await Promise.all([
				fetchRepoLanguages(repo.languages_url, token),
				includeContributors ? fetchRepoContributorsCount(owner, repo.name, token) : Promise.resolve(undefined),
			]);
			return {
				...repo,
				languages,
				contributors_count,
			};
		})
	);

	return enrichedRepos;
}

/**
 * Filter and sort repositories
 */
export function filterAndSortRepos(
	repos: GitHubRepo[],
	options: {
		excludeForks?: boolean;
		minStars?: number;
		blacklist?: string[];
		sortBy?: "stars" | "name" | "recent";
	} = {}
): GitHubRepo[] {
	const { excludeForks = true, minStars, blacklist = [], sortBy = "stars" } = options;

	let filtered = repos;

	// Filter forks
	if (excludeForks) {
		filtered = filtered.filter((repo) => !repo.fork);
	}

	// Filter by minimum stars (only if specified)
	if (minStars !== undefined && minStars >= 0) {
		filtered = filtered.filter((repo) => repo.stargazers_count >= minStars);
	}

	// Filter blacklisted projects
	if (blacklist.length > 0) {
		filtered = filtered.filter((repo) => !blacklist.includes(repo.name));
	}

	// Sort
	if (sortBy === "stars") {
		filtered.sort((a, b) => b.stargazers_count - a.stargazers_count);
	} else if (sortBy === "name") {
		filtered.sort((a, b) => a.name.localeCompare(b.name));
	} else if (sortBy === "recent") {
		filtered.sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime());
	}

	return filtered;
}

/**
 * Get featured projects (filtered and sorted)
 */
export async function getFeaturedProjects(
	username: string,
	token?: string,
	options: {
		blacklist?: string[];
		sortBy?: "stars" | "name" | "recent";
		includeLanguages?: boolean;
		excludeForks?: boolean;
	} = {}
): Promise<GitHubRepo[]> {
	const { blacklist = [], sortBy = "stars", includeLanguages = true, excludeForks = true } = options;

	const repos = await fetchGitHubRepos(username, token);

	const filtered = filterAndSortRepos(repos, {
		excludeForks,
		// No minStars filter - include all projects even with 0 stars
		blacklist,
		sortBy,
	});

	// Optionally enrich with language data
	if (includeLanguages) {
		return enrichReposWithLanguages(filtered, token);
	}

	return filtered;
}

/**
 * Get GitHub OpenGraph preview image URL
 * @param repoUrl - GitHub repository URL (e.g., https://github.com/owner/repo)
 * @returns OpenGraph image URL or null if invalid
 */
export function getGitHubOgImage(repoUrl: string): string | null {
	try {
		const url = new URL(repoUrl);
		const pathParts = url.pathname.split("/").filter(Boolean);

		if (pathParts.length >= 2) {
			const owner = pathParts[0];
			const repoName = pathParts[1];
			return `https://opengraph.githubassets.com/1/${owner}/${repoName}`;
		}

		return null;
	} catch (_e) {
		// Invalid URL
		return null;
	}
}

// =============================================================================
// CHANGELOG TYPES & FUNCTIONS
// =============================================================================

export interface GitHubCommit {
	sha: string;
	html_url: string;
	commit: {
		message: string;
		author: {
			name: string;
			date: string;
		};
	};
}

export interface ChangelogEntry {
	id: string;
	title: string;
	body: string | null;
	date: string;
	url: string;
	shortSha: string;
	author: string;
}

export interface ChangelogOptions {
	/** Maximum commits to fetch (default: 1000) */
	maxCommits?: number;
}

/**
 * Fetch ALL commits for a repository by paginating through the API.
 * Throws if any page fails: a partial history is not shipped.
 */
export async function fetchAllGitHubCommits(
	owner: string,
	repo: string,
	token?: string,
	options: { maxCommits?: number } = {}
): Promise<GitHubCommit[]> {
	const { maxCommits = 1000 } = options;
	const perPage = 100; // GitHub's max per request
	const headers = getGitHubHeaders(token);
	const allCommits: GitHubCommit[] = [];
	let page = 1;
	let hasMore = true;

	while (hasMore && allCommits.length < maxCommits) {
		const response = await githubFetch(
			`https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`,
			headers
		);
		const commits: GitHubCommit[] = await response.json();

		allCommits.push(...commits);
		page++;
		// Stop if we got fewer than requested (last page)
		hasMore = commits.length === perPage;
	}
	return allCommits.slice(0, maxCommits);
}

/**
 * Get changelog entries from ALL commits.
 * Fetches all commits at build time via pagination.
 */
export async function getChangelogEntries(
	owner: string,
	repo: string,
	token?: string,
	options: ChangelogOptions = {}
): Promise<ChangelogEntry[]> {
	const commits = await fetchAllGitHubCommits(owner, repo, token, {
		maxCommits: options.maxCommits || 1000,
	});

	return commits.map((commit) => {
		const messageLines = commit.commit.message.split("\n");
		const title = messageLines[0];
		// Body is everything after the first line (skip empty line after title)
		const bodyLines = messageLines.slice(1).filter((line, index) => !(index === 0 && line.trim() === ""));
		const body = bodyLines.length > 0 ? bodyLines.join("\n").trim() : null;

		return {
			id: `commit-${commit.sha}`,
			title,
			body,
			date: commit.commit.author.date,
			url: commit.html_url,
			shortSha: commit.sha.substring(0, 7),
			author: commit.commit.author.name,
		};
	});
}

/**
 * Get year from date string
 */
export function getYearFromDate(dateString: string): number {
	return new Date(dateString).getFullYear();
}

/**
 * Simple markdown to HTML converter for commit messages.
 * Sanitizes input by escaping HTML first, then applying safe transformations.
 */
export function renderMarkdownToHtml(markdown: string): string {
	if (!markdown) return "";

	// Escape HTML entities first (sanitization)
	let html = markdown.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

	// Convert markdown patterns to HTML (safe because we escaped first)

	// Code blocks (```code```)
	html = html.replace(
		/```(\w*)\n([\s\S]*?)```/g,
		'<pre class="bg-base-300 p-3 overflow-x-auto text-xs"><code>$2</code></pre>'
	);

	// Inline code (`code`)
	html = html.replace(/`([^`]+)`/g, '<code class="bg-base-300 px-1 text-xs">$1</code>');

	// Bold (**text** or __text__)
	html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");

	// Links [text](url). Only http/https schemes allowed to prevent javascript: injection
	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text: string, url: string) => {
		try {
			const { protocol } = new URL(url);
			if (protocol !== "https:" && protocol !== "http:") return text;
		} catch {
			return text;
		}
		return `<a href="${url}" class="underline decoration-dashed" target="_blank" rel="noopener noreferrer">${text}</a>`;
	});

	// Unordered lists (- item or * item)
	html = html.replace(/^[-*] (.+)$/gm, '<li class="ml-4">$1</li>');
	html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="list-disc list-inside my-2">$&</ul>');

	// Line breaks
	html = html.replace(/\n/g, "<br>");

	return html;
}
