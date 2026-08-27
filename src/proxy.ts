import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_MAX_AGE_SECONDS } from "@/lib/supabase/cookie-options";

// /checkin/[token] is deliberately NOT here — it's a public route (see
// docs/designdoc.md §3.1/§9 Phase 4): a venue's printed QR is scanned by a
// phone's own camera app with no session guaranteed, and the page itself
// branches on session presence rather than gating at the proxy.
const PROTECTED_PATHS = ["/home", "/events", "/profile", "/venues", "/admin"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          // @supabase/ssr hardcodes maxAge to its own 400-day default
          // internally regardless of any cookieOptions passed to
          // createServerClient (verified against the installed version), so
          // the session-length override has to happen here instead, on
          // every cookie this refreshes — this runs on every request to a
          // protected path, not just login.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              ...(options.maxAge
                ? { maxAge: SESSION_COOKIE_MAX_AGE_SECONDS }
                : {}),
            })
          );
        },
      },
    }
  );

  // Do not add code between createServerClient and getClaims() — a stray
  // read here can make session-refresh bugs very hard to trace.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!claims && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
