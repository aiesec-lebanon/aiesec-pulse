// Approval queue — RSC. Lists PENDING posts; admin approves or rejects each.
// TODO: implement queue list with approvePost / rejectPost Server Actions.
export default function AdminQueuePage() {
  return (
    <main className="flex-1 mx-auto w-full max-w-[1200px] px-6 py-8">
      <h1 className="text-[20px] font-bold text-foreground mb-6">Approval Queue</h1>
      <p className="text-muted-foreground">Queue coming soon.</p>
    </main>
  );
}
