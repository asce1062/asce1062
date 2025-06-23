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
    description: string;
    description1?: string;
    description2?: string;
    description3?: string;
    description4?: string;
    description5?: string;
    moreInformation?: string;
}
