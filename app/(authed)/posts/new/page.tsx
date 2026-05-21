// MCP-only post composer — guarded by requireMCP() in the Server Action.
// TODO: implement PostComposer form with image upload via /api/storage/sign.
export default function NewPostPage() {
  return (
    <main className="flex-1 mx-auto w-full max-w-[1200px] px-6 py-8">
      <h1 className="text-[20px] font-bold text-foreground mb-6">New Post</h1>
      <p className="text-muted-foreground">Post composer coming soon.</p>
    </main>
  );
}
