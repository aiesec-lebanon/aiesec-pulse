import type { FollowState } from "@/app/actions/follows";

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
  publisherEntityId: string;
  /** The viewer's own follow state for the publishing entity — "none" when signed out. */
  entityFollowState: FollowState;
  reactionCount: number;
  commentCount: number;
  publishedAt: Date;
  topics: Array<{ slug: string; name: string }>;
};
