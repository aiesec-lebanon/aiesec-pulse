import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { positionId } = await request.json();

    if (!positionId) {
      return NextResponse.json({ error: "Position ID is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const isProd = process.env.DEPLOYMENT_ENV === "production";
    cookieStore.set("active_position_id", String(positionId), {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update active role" }, { status: 500 });
  }
}
