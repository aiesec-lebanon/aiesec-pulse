// Post detail page — RSC. Shows post body, comments, like count.
// TODO: implement post detail with CommentList and LikeButton.
export default function PostDetailPage({ params }: { params: { id: string } }) {
  return (
    <main className="flex-1 mx-auto w-full max-w-[1200px] px-6 py-8">
      <h1 className="text-[20px] font-bold text-foreground mb-4">Post Detail</h1>
      <p className="text-muted-foreground">Post {params.id} — coming soon.</p>
    </main>
  );
}
