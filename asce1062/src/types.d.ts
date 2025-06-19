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
