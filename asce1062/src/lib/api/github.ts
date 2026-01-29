/**
 * GitHub API utilities
 * Handles fetching and processing GitHub repository data
 */

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
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	};

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	let allRepos: GitHubRepo[] = [];
	let page = 1;
	let hasMore = true;

	// Fetch all pages
	while (hasMore) {
		const response = await fetch(
			`https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=pushed`,
			{
				headers,
			}
		);

		if (!response.ok) {
			throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
		}

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
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	};

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	try {
		const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=1&anon=true`, {
			headers,
		});
		if (!response.ok) return 0;

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
	} catch (error) {
		console.error(`Failed to fetch contributors for ${owner}/${repo}:`, error);
		return 0;
	}
}

/**
 * Fetch languages for a repository
 */
async function fetchRepoLanguages(languagesUrl: string, token?: string): Promise<string[]> {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	};

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	try {
		const response = await fetch(languagesUrl, { headers });
		if (!response.ok) return [];

		const languages = await response.json();
		// Returns object like { "TypeScript": 12345, "JavaScript": 6789 }
		// We just need the language names
		return Object.keys(languages);
	} catch (error) {
		console.error(`Failed to fetch languages from ${languagesUrl}:`, error);
		return [];
	}
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
