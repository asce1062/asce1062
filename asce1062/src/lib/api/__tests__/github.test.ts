/**
 * Unit tests for github.ts utilities.
 * renderMarkdownToHtml (XSS regression protection)
 * getRepoSlugFromUrl, getBaseRepoUrl (URL parsing contract)
 *
 * renderMarkdownToHtml was recently patched for a javascript: URL injection
 * vulnerability. The HTML-escaping-first ordering is the critical security
 * invariant. If a future change inverts it, <script> tags in commit messages
 * would become executable on the changelog page.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderMarkdownToHtml, getRepoSlugFromUrl, getBaseRepoUrl } from "@/lib/api/github";

// ---------------------------------------------------------------------------
// renderMarkdownToHtml
// ---------------------------------------------------------------------------

describe("renderMarkdownToHtml. HTML escaping (security-critical ordering)", () => {
	it("returns empty string for empty input", () => {
		expect(renderMarkdownToHtml("")).toBe("");
	});

	it("escapes < and >. Raw HTML tags must not appear in output", () => {
		const result = renderMarkdownToHtml("<script>alert(1)</script>");
		expect(result).not.toContain("<script>");
		expect(result).toContain("&lt;script&gt;");
	});

	it("escapes & to &amp;", () => {
		const result = renderMarkdownToHtml("Hello & World");
		expect(result).toContain("&amp;");
	});

	it('escapes " to &quot;', () => {
		const result = renderMarkdownToHtml('say "hello"');
		expect(result).toContain("&quot;");
	});

	it("escapes all four entities in a single input", () => {
		const result = renderMarkdownToHtml('a & b < c > d "e"');
		expect(result).toContain("&amp;");
		expect(result).toContain("&lt;");
		expect(result).toContain("&gt;");
		expect(result).toContain("&quot;");
	});

	it("double-escapes already-escaped entities (correct: escaping is not idempotent)", () => {
		// Input contains &amp; After the escape pass, & becomes &amp; → produces &amp;amp;
		const result = renderMarkdownToHtml("&amp;");
		expect(result).toContain("&amp;amp;");
	});

	it("escapes an XSS img onerror payload. No raw <img> tag in output", () => {
		const result = renderMarkdownToHtml('<img src=x onerror="alert(1)">');
		expect(result).not.toContain("<img");
		expect(result).toContain("&lt;img");
	});

	it("escaping runs before markdown transforms. HTML inside **bold** is escaped", () => {
		// **<b>bold</b>** → first escape → **&lt;b&gt;bold&lt;/b&gt;** → then bold transform
		const result = renderMarkdownToHtml("**<b>bold</b>**");
		expect(result).toContain("<strong>");
		expect(result).not.toContain("<b>"); // raw <b> must not appear
	});
});

describe("renderMarkdownToHtml. Link URL validation (javascript: injection regression)", () => {
	it("renders https: links as anchor tags with noopener noreferrer", () => {
		const result = renderMarkdownToHtml("[click](https://example.com)");
		expect(result).toContain('<a href="https://example.com"');
		expect(result).toContain('rel="noopener noreferrer"');
		expect(result).toContain('target="_blank"');
		expect(result).toContain("click");
	});

	it("renders http: links as anchor tags", () => {
		const result = renderMarkdownToHtml("[click](http://example.com)");
		expect(result).toContain('<a href="http://example.com"');
	});

	it("blocks javascript: scheme. Emits only link text, no anchor element", () => {
		const result = renderMarkdownToHtml("[click](javascript:alert(1))");
		expect(result).not.toContain("<a");
		expect(result).not.toContain("javascript:");
		expect(result).toContain("click");
	});

	it("blocks data: scheme. Emits only link text", () => {
		const result = renderMarkdownToHtml("[click](data:text/html,<h1>hi</h1>)");
		expect(result).not.toContain("<a");
		expect(result).toContain("click");
	});

	it("blocks vbscript: scheme. Emits only link text", () => {
		const result = renderMarkdownToHtml("[click](vbscript:msgbox(1))");
		expect(result).not.toContain("<a");
		expect(result).toContain("click");
	});

	it("handles malformed URL (URL constructor throws). Emits only link text", () => {
		const result = renderMarkdownToHtml("[click](not a url with spaces)");
		expect(result).not.toContain("<a");
		expect(result).toContain("click");
	});
});

describe("renderMarkdownToHtml. Markdown transforms", () => {
	it("renders **text** as <strong>", () => {
		const result = renderMarkdownToHtml("**bold**");
		expect(result).toContain("<strong>bold</strong>");
	});

	it("renders __text__ as <strong>", () => {
		const result = renderMarkdownToHtml("__bold__");
		expect(result).toContain("<strong>bold</strong>");
	});

	it("renders __text__ mid-sentence as <strong>", () => {
		expect(renderMarkdownToHtml("a __bold__ word.")).toBe("a <strong>bold</strong> word.");
	});

	it("leaves intraword double underscores literal (BEM class names)", () => {
		const commit = "Updated terminal-window__body scanlines; moved into terminal-window__body::before";
		expect(renderMarkdownToHtml(commit)).toBe(commit);
	});

	it("renders inline `code` as <code>", () => {
		const result = renderMarkdownToHtml("`inline code`");
		expect(result).toContain("<code");
		expect(result).toContain("inline code");
	});

	it("renders fenced code block as <pre><code>", () => {
		const result = renderMarkdownToHtml("```js\nconsole.log()\n```");
		expect(result).toContain("<pre");
		expect(result).toContain("<code>");
		expect(result).toContain("console.log()");
	});

	it("renders - list item wrapped in <ul>", () => {
		const result = renderMarkdownToHtml("- item one\n- item two");
		expect(result).toContain("<ul");
		expect(result).toContain("<li");
		expect(result).toContain("item one");
	});

	it("converts remaining newlines to <br>", () => {
		const result = renderMarkdownToHtml("line one\nline two");
		expect(result).toContain("<br>");
	});
});

// ---------------------------------------------------------------------------
// getRepoSlugFromUrl
// ---------------------------------------------------------------------------

describe("getRepoSlugFromUrl", () => {
	it("parses a standard GitHub repo URL", () => {
		expect(getRepoSlugFromUrl("https://github.com/user/repo")).toEqual({ owner: "user", repo: "repo" });
	});

	it("ignores extra path segments. Tree path returns only owner + repo", () => {
		expect(getRepoSlugFromUrl("https://github.com/user/repo/tree/main")).toEqual({ owner: "user", repo: "repo" });
	});

	it("ignores blob path", () => {
		expect(getRepoSlugFromUrl("https://github.com/user/repo/blob/main/README.md")).toEqual({
			owner: "user",
			repo: "repo",
		});
	});

	it("returns null for a URL with only one path segment", () => {
		expect(getRepoSlugFromUrl("https://github.com/user")).toBeNull();
	});

	it("returns null for a bare domain with no path", () => {
		expect(getRepoSlugFromUrl("https://github.com/")).toBeNull();
	});

	it("returns null for a non-URL string", () => {
		expect(getRepoSlugFromUrl("not-a-url")).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(getRepoSlugFromUrl("")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// getBaseRepoUrl
// ---------------------------------------------------------------------------

describe("getBaseRepoUrl", () => {
	it("returns the repo root URL from a standard URL", () => {
		expect(getBaseRepoUrl("https://github.com/user/repo")).toBe("https://github.com/user/repo");
	});

	it("strips tree path. Returns the repo root", () => {
		expect(getBaseRepoUrl("https://github.com/user/repo/tree/main")).toBe("https://github.com/user/repo");
	});

	it("returns null for a non-URL string", () => {
		expect(getBaseRepoUrl("not-a-url")).toBeNull();
	});

	it("returns null for a URL with fewer than 2 path segments", () => {
		expect(getBaseRepoUrl("https://github.com/user")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// fetchGitHubRepos (pagination + error handling)
// ---------------------------------------------------------------------------

describe("fetchGitHubRepos", () => {
	// Import fetchGitHubRepos separately so we can test it with a mocked fetch
	let fetchGitHubRepos: (username: string, token?: string) => Promise<unknown[]>;

	beforeEach(async () => {
		vi.stubGlobal("fetch", vi.fn());
		// Dynamic import after stubbing global fetch
		const mod = await import("@/lib/api/github");
		fetchGitHubRepos = mod.fetchGitHubRepos;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetAllMocks();
	});

	it("throws on a non-OK response from the GitHub API", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce(new Response(null, { status: 401, statusText: "Unauthorized" }));
		await expect(fetchGitHubRepos("testuser")).rejects.toThrow("GitHub API error: 401");
	});

	it("collects all repos across multiple pages and stops on empty page", async () => {
		const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `repo-${i}` }));
		const page2 = [{ id: 100, name: "repo-100" }];

		vi.mocked(global.fetch)
			.mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 })); // empty = stop

		const repos = await fetchGitHubRepos("testuser");
		expect(repos).toHaveLength(101);
		expect(global.fetch).toHaveBeenCalledTimes(3);
	});

	it("returns empty array when the first page is empty", async () => {
		vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
		const repos = await fetchGitHubRepos("testuser");
		expect(repos).toHaveLength(0);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Failure policy: a failed request fails the build, transient ones retry first
// ---------------------------------------------------------------------------

describe("GitHub failure policy", () => {
	const json = (body: unknown, init: ResponseInit = { status: 200 }) => new Response(JSON.stringify(body), init);
	const commit = (sha: string) => ({
		sha,
		html_url: `https://github.com/o/r/commit/${sha}`,
		commit: { message: `title ${sha}\n\nbody ${sha}`, author: { name: "Alex", date: "2026-10-24T10:00:00Z" } },
	});

	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.resetAllMocks();
	});

	/** Run a call to completion, letting retry backoff timers fire. */
	async function settle<T>(promise: Promise<T>): Promise<T> {
		const outcome = promise.then(
			(value) => ({ value }),
			(error: unknown) => ({ error })
		);
		await vi.runAllTimersAsync();
		const result = await outcome;
		if ("error" in result) throw result.error;
		return result.value;
	}

	it("retries a 5xx and a network error, then succeeds", async () => {
		const { fetchGitHubRepos } = await import("@/lib/api/github");
		vi.mocked(global.fetch)
			.mockResolvedValueOnce(new Response(null, { status: 502, statusText: "Bad Gateway" }))
			.mockRejectedValueOnce(new TypeError("fetch failed"))
			.mockResolvedValueOnce(json([{ name: "a" }]))
			.mockResolvedValueOnce(json([]));

		await expect(settle(fetchGitHubRepos("u"))).resolves.toHaveLength(1);
		expect(global.fetch).toHaveBeenCalledTimes(4);
	});

	it("gives up after three attempts", async () => {
		const { fetchGitHubRepos } = await import("@/lib/api/github");
		vi.mocked(global.fetch).mockResolvedValue(new Response(null, { status: 503, statusText: "Unavailable" }));

		await expect(settle(fetchGitHubRepos("u"))).rejects.toThrow("GitHub API error: 503");
		expect(global.fetch).toHaveBeenCalledTimes(3);
	});

	it("does not retry a 403 rate limit without Retry-After (it resets in up to an hour)", async () => {
		const { fetchGitHubRepos } = await import("@/lib/api/github");
		vi.mocked(global.fetch).mockResolvedValue(new Response(null, { status: 403, statusText: "Forbidden" }));

		await expect(settle(fetchGitHubRepos("u"))).rejects.toThrow("GitHub API error: 403");
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it("retries a secondary rate limit after its Retry-After", async () => {
		const { fetchGitHubRepos } = await import("@/lib/api/github");
		vi.mocked(global.fetch)
			.mockResolvedValueOnce(new Response(null, { status: 403, headers: { "Retry-After": "2" } }))
			.mockResolvedValueOnce(json([]));

		await expect(settle(fetchGitHubRepos("u"))).resolves.toEqual([]);
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it("fails the changelog when a later page fails instead of shipping a partial history", async () => {
		const { getChangelogEntries } = await import("@/lib/api/github");
		vi.mocked(global.fetch)
			.mockResolvedValueOnce(json(Array.from({ length: 100 }, (_, i) => commit(`sha${i}`))))
			.mockResolvedValue(new Response(null, { status: 401, statusText: "Unauthorized" }));

		await expect(settle(getChangelogEntries("o", "r"))).rejects.toThrow("GitHub API error: 401");
	});

	it("maps commits to changelog entries", async () => {
		const { getChangelogEntries } = await import("@/lib/api/github");
		vi.mocked(global.fetch).mockResolvedValueOnce(json([commit("abcdef1234")]));

		await expect(settle(getChangelogEntries("o", "r"))).resolves.toEqual([
			{
				id: "commit-abcdef1234",
				title: "title abcdef1234",
				body: "body abcdef1234",
				date: "2026-10-24T10:00:00Z",
				url: "https://github.com/o/r/commit/abcdef1234",
				shortSha: "abcdef1",
				author: "Alex",
			},
		]);
	});

	it("fails project enrichment instead of showing empty languages", async () => {
		const { enrichReposWithLanguages } = await import("@/lib/api/github");
		const repo = {
			name: "r",
			html_url: "https://github.com/o/r",
			languages_url: "https://api.github.com/repos/o/r/languages",
		};
		vi.mocked(global.fetch).mockImplementation(async (url) =>
			String(url).endsWith("/languages")
				? new Response(null, { status: 404, statusText: "Not Found" })
				: json([{ login: "a" }])
		);

		await expect(settle(enrichReposWithLanguages([repo as never]))).rejects.toThrow("GitHub API error: 404");
	});

	it("counts an empty repository (204) as zero contributors", async () => {
		const { enrichReposWithLanguages } = await import("@/lib/api/github");
		const repo = {
			name: "r",
			html_url: "https://github.com/o/r",
			languages_url: "https://api.github.com/repos/o/r/languages",
		};
		vi.mocked(global.fetch).mockImplementation(async (url) =>
			String(url).endsWith("/languages") ? json({ TypeScript: 10 }) : new Response(null, { status: 204 })
		);

		await expect(settle(enrichReposWithLanguages([repo as never]))).resolves.toMatchObject([
			{ languages: ["TypeScript"], contributors_count: 0 },
		]);
	});
});
