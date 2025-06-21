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
    desc: string;
    desc1?: string;
    desc2?: string;
    desc3?: string;
    desc4?: string;
    desc5?: string;
}
