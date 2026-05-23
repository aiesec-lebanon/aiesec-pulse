export type FeedPost = {
  id: string;
  title: string;
  excerpt: string;
  mediaUrl: string | null;
  author: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    committeeName: string | null;
  };
  likeCount: number;
  commentCount: number;
  createdAt: Date;
};
