"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Escalas", icon: LayoutDashboard },
  { href: "/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/cargos", label: "Cargos", icon: Briefcase },
  { href: "/config", label: "Configurações", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    const supabase = getClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f5f3ee] flex flex-col">
      {/* Top menu */}
      <header className="bg-white border-b border-[#e8e2d4] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo + Nav */}
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
                <img
                  src="/logo-integra-escala.png"
                  alt="Integra Escala"
                  className="h-8 w-auto"
                />
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-[#1a3c34]/10 text-[#1a3c34]"
                          : "text-[#666] hover:text-[#1a3c34] hover:bg-[#1a3c34]/5"
                      }`}
                    >
                      <Icon size={16} strokeWidth={2} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="text-sm text-[#8b7d6b] hover:text-red-600 transition hidden sm:flex items-center gap-1.5"
              >
                <LogOut size={14} strokeWidth={2} />
                Sair
              </button>
              {/* Mobile menu toggle */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden p-2 text-[#555] hover:text-[#1a3c34]"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="md:hidden border-t border-[#e8e2d4] bg-white">
            <div className="px-4 py-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#1a3c34]/10 text-[#1a3c34]"
                        : "text-[#666] hover:text-[#1a3c34]"
                    }`}
                  >
                    <Icon size={16} strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={14} strokeWidth={2} />
                Sair
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}