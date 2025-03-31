export type FrontMatter = {
    title: string;
    ogTitle: string;
    image: string;
    imageAlt: string;
    publishedDate: string;
    modifiedDate: string;
    tags: string;
    description: string;
};

const AVERAGE_WORD_PER_MINUTE = 240;

export function calculateReadingTime(text: string): number {
    return Math.ceil(text.split(" ").length / AVERAGE_WORD_PER_MINUTE);
}
