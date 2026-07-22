"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getClient();
    if (!supabase) {
      setError("Configuração do Supabase ausente.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Email ou senha inválidos."
          : error.message === "Email not confirmed"
          ? "Confirme seu email antes de fazer login."
          : "Erro ao fazer login. Tente novamente."
      );
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center scale-110"
        style={{ backgroundImage: "url('/bg-login.jpg')" }}
      />
      <div className="absolute inset-0 backdrop-blur-[6px] bg-black/20" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl px-10 py-12">
          <div className="flex justify-center mb-8">
            <img
              src="/logo-integra-escala.png"
              alt="Integra Escala"
              className="h-20 w-auto"
            />
          </div>

          <h1 className="text-center text-xl font-medium text-[#1a1a1a] mb-8">
            Acesse sua conta
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#555] mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[#d4cdc0] rounded-lg px-4 py-3 text-sm outline-none transition focus:border-[#1a3c34] focus:ring-2 focus:ring-[#1a3c34]/10"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#555] mb-1.5">
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#d4cdc0] rounded-lg px-4 py-3 text-sm outline-none transition focus:border-[#1a3c34] focus:ring-2 focus:ring-[#1a3c34]/10"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1a3c34] text-white font-medium rounded-lg py-3 text-sm transition hover:bg-[#143028] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="text-center text-sm text-[#8b7d6b] mt-6">
            Ainda não tem conta?{" "}
            <a href="/cadastro" className="text-[#1a3c34] font-medium hover:underline">
              Cadastre-se
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}