import { type NextRequest, NextResponse } from "next/server";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/escala",
  "/colaboradores",
  "/cargos",
  "/config",
  "/convites",
];

const AUTH_ROUTES = ["/login", "/cadastro", "/recuperar-senha"];

function isProtected(pathname: string) {
  return PROTECTED_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  // Ponytail: Autenticação baseada em cookie local e offline-friendly
  const loggedInCookie = request.cookies.get("integra_escala_logged_in");
  const isLoggedIn = loggedInCookie?.value === "true";

  // O cookie é apenas um hint de UX para redirecionamento — NÃO é autenticação real.
  // Qualquer script no origin pode forgá-lo (sem HttpOnly). O gate real de autenticação
  // é getLocalUser() em cada página, que valida contra o IndexedDB do próprio usuário.
  if (isProtected(pathname) && !isLoggedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute(pathname) && isLoggedIn) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
  ],
};
