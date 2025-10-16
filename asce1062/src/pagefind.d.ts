declare module "@pagefind/default-ui" {
	export class PagefindUI {
		constructor(options: {
			element: string;
			bundlePath?: string;
			showImages?: boolean;
			showSubResults?: boolean;
			debounceTimeoutMs?: number;
			autofocus?: boolean;
			showEmptyFilters?: boolean;
			sort?: {
				[key: string]: "asc" | "desc";
			};
			translations?: {
				placeholder?: string;
				zero_results?: string;
				search_label?: string;
				clear_search?: string;
			};
		});
	}
}
