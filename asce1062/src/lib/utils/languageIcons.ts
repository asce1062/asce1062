/**
 * Map programming language names to icon classes
 */
export function getLanguageIcon(language: string): string | null {
	const languageMap: Record<string, string> = {
		// Icon matches
		// Languages
		TypeScript: "icon-typescript",
		JavaScript: "icon-javascript",
		Python: "icon-python",
		Java: "icon-java",
		Go: "icon-go",
		C: "icon-c",
		"C++": "icon-cplusplus",
		"C#": "icon-csharp",
		Perl: "icon-perl",
		"Objective-C": "icon-objectivec",
		CSS: "icon-css",
		HTML: "icon-html",
		JSON: "icon-json",
		XML: "icon-xml",
		Shell: "icon-bash",
		Bash: "icon-bash",
		Assembly: "icon-assembly",
		PHP: "icon-php",
		Ruby: "icon-ruby",
		Markdown: "icon-markdown",
		MDX: "icon-markdown",
		Erlang: "icon-erlang",
		Scala: "icon-scala",
		AWK: "icon-awk",
		LaTeX: "icon-latex",
		TeX: "icon-tex",
		CMake: "icon-cmake",
		Prolog: "icon-prolog",
		Vim: "icon-vim",
		"Vim Script": "icon-vim",

		// Frameworks/Tools
		Astro: "icon-astro",
		React: "icon-react",
		Flask: "icon-flask",
		".NET": "icon-dot-net",
		"Visual Basic .NET": "icon-dot-net",

		// Database
		MSSQL: "icon-mssql",
		SQLAlchemy: "icon-sqlalchemy",
	};

	// Try exact match first
	if (languageMap[language]) {
		return languageMap[language];
	}

	// Try case-insensitive match
	const languageLower = language.toLowerCase();
	for (const [key, value] of Object.entries(languageMap)) {
		if (key.toLowerCase() === languageLower) {
			return value;
		}
	}

	// No icon found
	return null;
}
