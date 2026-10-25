/**
 * Pagefind search UI, loaded on demand.
 *
 * The UI library (~95 KiB) and its styles are split into their own chunk so
 * they are not downloaded on every page: the /search page builds its box as
 * soon as it loads, the floating search modal builds its box on first open
 * (and starts the download on hover/focus of its button).
 */
type PagefindModule = typeof import("@/scripts/pagefindUi");

let pagefindModule: Promise<PagefindModule> | null = null;

/** Start downloading the search UI and its styles without building anything. */
export function preloadPagefindUi(): Promise<PagefindModule> {
	pagefindModule ??= import("@/scripts/pagefindUi").catch((error: unknown) => {
		// Allow a retry (e.g. after reconnecting) instead of caching the failure.
		pagefindModule = null;
		throw error;
	});
	return pagefindModule;
}

/** Only the dedicated /search box mirrors its query in ?q=; the floating modal must not touch page URLs. */
function syncQueryParam(el: HTMLElement, input: HTMLInputElement): void {
	const query = new URLSearchParams(window.location.search).get("q");
	if (query) {
		input.value = query;
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}

	const writeQuery = (value: string) => {
		const url = new URL(window.location.href);
		if (value.trim()) url.searchParams.set("q", value);
		else url.searchParams.delete("q");
		const search = url.searchParams.toString();
		window.history.replaceState({}, "", search ? `${url.pathname}?${search}` : url.pathname);
	};

	input.addEventListener("input", () => writeQuery(input.value));
	el.querySelector(".pagefind-ui__search-clear")?.addEventListener("click", () => writeQuery(""));
}

const builds = new WeakMap<HTMLElement, Promise<HTMLInputElement | null>>();

/**
 * Build the Pagefind UI inside `el` (a [data-pagefind-ui] element) once.
 * Resolves with the search input, or null when the UI could not be loaded
 * (a later call retries).
 */
export function initPagefindSearch(el: HTMLElement): Promise<HTMLInputElement | null> {
	let build = builds.get(el);
	if (!build) {
		build = buildSearch(el);
		builds.set(el, build);
		void build.then((input) => {
			if (!input) builds.delete(el);
		});
	}
	return build;
}

async function buildSearch(el: HTMLElement): Promise<HTMLInputElement | null> {
	let PagefindUI: PagefindModule["PagefindUI"];
	try {
		const ui = await preloadPagefindUi();
		ui.ensurePagefindStyles();
		PagefindUI = ui.PagefindUI;
	} catch (error) {
		console.error("[search] could not load the search UI", error);
		return null;
	}

	el.replaceChildren(); // clear a previous failure message before building
	const elSelector = [
		...(el.id ? [`#${el.id}`] : []),
		...[...el.classList.values()].map((c) => `.${c}`),
		"[data-pagefind-ui]",
	].join("");

	new PagefindUI({
		element: elSelector,
		bundlePath: el.dataset.bundlePath || undefined,
		showImages: false,
		showSubResults: true,
		debounceTimeoutMs: 120,
		autofocus: el.dataset.autofocus === "true",
		showEmptyFilters: false,
		sort: {
			date: "desc",
		},
		translations: {
			placeholder: "Search",
			zero_results: "No matches found",
			search_label: "Search site",
			clear_search: "Clear",
		},
	});

	const input = el.querySelector<HTMLInputElement>("input[type='text']");
	if (!input) return null;
	if (el.id && !input.id) input.id = `${el.id}-input`;
	if (!input.name) input.name = "q";
	if (el.id === "page-searchbox") syncQueryParam(el, input);
	return input;
}
