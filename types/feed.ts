export type FeedPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  mediaUrl: string | null;
  mediaAlt: string | null;
  author: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    entityName: string | null;
  };
  reactionCount: number;
  commentCount: number;
  publishedAt: Date;
};
