import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Pull from env, but throw a warning in the logs if falling back to default in Unraid
const rawSecret = process.env.JWT_SECRET || "default-secret-key-change-me";
if (process.env.NODE_ENV === "production" && rawSecret === "default-secret-key-change-me") {
  console.warn("⚠️ WARNING: Using default JWT_SECRET. Please add a JWT_SECRET variable to your Unraid Docker template!");
}
const SECRET_KEY = new TextEncoder().encode(rawSecret);

export async function middleware(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  const { pathname } = req.nextUrl;

  // 1. ALLOW THE LOGIN PAGE
  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // Optional: If you need Tautulli webhooks to hit your app without a login, 
  // uncomment the line below and specify the exact route!
  // if (pathname.startsWith("/api/webhooks")) return NextResponse.next();

  // 2. CHECK FOR A SESSION ON ALL OTHER PAGES
  if (!session) {
    // Return proper API 401 instead of redirecting JSON requests to a login page
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 3. VERIFY THE SESSION IS VALID AND NOT EXPIRED
  try {
    // jose is highly efficient and runs perfectly on the Edge runtime
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
  // Protects everything EXCEPT static assets, images, and the favicon
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};