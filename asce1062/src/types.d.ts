export interface Posts {
  url: string;
  frontmatter: {
    title: string;
    description: string;
    image: {
      url: string;
    };
    pubDate: string | Date;
    tags: string[];
  };
}

export interface TimelineEntry {
  title: string;
  date: string;
  descriptions: string[];
  moreInformation?: string;
}

export interface TimelineSection {
  sectionTitle: string;
  entries: TimelineEntry[];
}

export interface SkillCategory {
  categoryTitle: string;
  skills: string[];
}

export interface SkillsSection {
  sectionTitle: string;
  items?: string[];
  categories?: SkillCategory[];
}

export interface Frontmatter {
  title: string;
  description: string;
  image: {
    url: string;
    alt: string;
  };
  pubDate: string;
  tags: string[];
  permalink: string;
}

export interface TableOfContentsEntry {
  value: string;
  depth: number;
  id?: string;
  children?: Array<TableOfContentsEntry>;
}

export type TableOfContents = Array<TableOfContentsEntry>;
