"use client";

export default function LoginPage() {
  const handleLogin = () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.NEXT_PUBLIC_CLIENT_ID || "",
      redirect_uri: `${process.env.NEXT_PUBLIC_REDIRECT_URI}`,
    });

    window.location.href = `${process.env.NEXT_PUBLIC_AUTH_URL}/authorize?${params.toString()}`;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-6">
      <div className="aiesec-card flex w-full max-w-sm flex-col items-center gap-6 px-8 py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-[22px] font-black tracking-[0.08em] text-[var(--brand)] uppercase">
            AIESEC Pulse
          </span>
          <p className="text-sm text-[var(--muted-foreground)]">
            The global news platform for AIESEC entities worldwide.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          className="aiesec-btn-primary w-full"
        >
          Login with AIESEC
        </button>
      </div>
    </div>
  );
}
