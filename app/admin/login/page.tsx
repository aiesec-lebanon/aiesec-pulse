// Admin login — separate from AIESEC OAuth. Uses bcrypt + JWT admin_session cookie.
// TODO: implement adminLogin Server Action form.
export default function AdminLoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-8">
      <div className="aiesec-card p-8 w-full max-w-sm">
        <h1 className="text-[20px] font-bold text-foreground mb-6">Admin Login</h1>
        <p className="text-muted-foreground text-sm">Admin login form coming soon.</p>
      </div>
    </main>
  );
}
