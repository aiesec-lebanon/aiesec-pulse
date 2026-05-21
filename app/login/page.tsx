"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.NEXT_PUBLIC_CLIENT_ID || "",
      redirect_uri: `${process.env.NEXT_PUBLIC_REDIRECT_URI}`,
    });

    window.location.href = `${process.env.NEXT_PUBLIC_AUTH_URL}/authorize?${params.toString()}`;
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  );
}
