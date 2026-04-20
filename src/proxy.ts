import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const rawSecret = process.env.JWT_SECRET || "default-secret-key-change-me";
const SECRET_KEY = new TextEncoder().encode(rawSecret);

// Next.js 16 convention: export default function proxy
export default async function proxy(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(session, SECRET_KEY);
    return NextResponse.next(); 
  } catch (err) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Invalid Session" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};