/**
 * Type Definitions
 * Centralized type safety for the entire application
 */

/**
 * Blog Post Interface
 * Used for blog post data throughout the application
 */
export interface Posts {
	url: string;
	frontmatter: Frontmatter;
}

/**
 * Post Frontmatter
 * Metadata for blog posts
 */
export interface Frontmatter {
	title: string;
	description: string;
	image: ImageMetadata;
	pubDate: string | Date;
	tags: readonly string[];
	permalink?: string;
}

/**
 * Image Metadata
 * Structured image data with required alt text
 */
export interface ImageMetadata {
	url: string;
	alt: string;
}

/**
 * Timeline Interfaces
 * Used for resume/timeline components
 */
export interface TimelineEntry {
	readonly title: string;
	readonly date: string;
	readonly descriptions: readonly string[];
	readonly moreInformation?: string;
}

export interface TimelineSection {
	readonly sectionTitle: string;
	readonly entries: readonly TimelineEntry[];
}

/**
 * Skills Interfaces
 * Used for skills sections in resume
 */
export interface SkillCategory {
	readonly categoryTitle: string;
	readonly skills: readonly string[];
}

export interface SkillsSection {
	readonly sectionTitle: string;
	readonly items?: readonly string[];
	readonly categories?: readonly SkillCategory[];
}

/**
 * Table of Contents
 * Hierarchical content structure for blog posts
 */
export interface TableOfContentsEntry {
	readonly value: string;
	readonly depth: number;
	readonly id?: string;
	readonly children?: readonly TableOfContentsEntry[];
}

export type TableOfContents = readonly TableOfContentsEntry[];

/**
 * Component Props Interfaces
 */

/**
 * Post Component Props
 */
export interface PostProps {
	readonly name: string;
	readonly url: string;
	readonly image: string;
	readonly description: string;
	readonly date: string;
}

/**
 * Image View Component Props
 */
export interface ImageViewProps {
	readonly image: string;
	readonly altText: string;
	readonly maxWidth?: string;
}

/**
 * Preview Image Component Props
 */
export interface PreviewImageProps {
	readonly src: string;
	readonly altText: string;
}

/**
 * Iframe Theme Configuration
 * Used for managing iframe theme synchronization across the site
 */
export interface IframeThemeConfig {
	/** The iframe element ID */
	readonly id: string;
	/**
	 * How to update the iframe theme
	 * - 'src-query': Update a query parameter in the iframe src (e.g., ?scheme=dark)
	 * - 'color-scheme': Only update the color-scheme style property
	 */
	readonly updateMethod: "src-query" | "color-scheme";
	/**
	 * For 'src-query' method: the query parameter name to update
	 * Example: 'scheme' for ?scheme=dark
	 */
	readonly queryParam?: string;
	/**
	 * For 'src-query' method: mapping of theme to query value
	 * Example: { dark: 'dark', light: 'light' }
	 */
	readonly queryValues?: {
		readonly dark: string;
		readonly light: string;
	};
}
