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

export default function CadastroPage() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getClient();
    if (!supabase) {
      setError("Configuração do Supabase ausente.");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome },
      },
    });

    if (signUpError) {
      setError(
        signUpError.message === "User already registered"
          ? "Este email já está cadastrado."
          : "Erro ao criar conta. Tente novamente."
      );
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-110"
          style={{ backgroundImage: "url('/bg-login.jpg')" }}
        />
        <div className="absolute inset-0 backdrop-blur-[6px] bg-black/20" />

        <div className="relative z-10 w-full max-w-md mx-4">
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl px-10 py-12 text-center">
            <div className="flex justify-center mb-6">
              <img src="/logo-integra-escala.png" alt="Integra Escala" className="h-20 w-auto" />
            </div>
            <h2 className="text-xl font-medium text-[#1a3c34] mb-3">Conta criada!</h2>
            <p className="text-[#555] text-sm mb-6">
              Enviamos um link de confirmação para <strong>{email}</strong>.
              Verifique sua caixa de entrada e clique no link para ativar sua conta.
            </p>
            <a
              href="/login"
              className="inline-block bg-[#1a3c34] text-white font-medium rounded-lg px-6 py-3 text-sm hover:bg-[#143028]"
            >
              Ir para o login
            </a>
          </div>
        </div>
      </div>
    );
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
            <img src="/logo-integra-escala.png" alt="Integra Escala" className="h-20 w-auto" />
          </div>

          <h1 className="text-center text-xl font-medium text-[#1a1a1a] mb-8">
            Criar sua conta
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-5">
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-[#555] mb-1.5">
                Nome completo
              </label>
              <input
                id="nome"
                type="text"
                required
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full border border-[#d4cdc0] rounded-lg px-4 py-3 text-sm outline-none transition focus:border-[#1a3c34] focus:ring-2 focus:ring-[#1a3c34]/10"
              />
            </div>

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
                minLength={6}
                placeholder="Mínimo 6 caracteres"
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
              {loading ? "Criando conta..." : "Criar conta"}
            </button>
          </form>

          <p className="text-center text-sm text-[#8b7d6b] mt-6">
            Já tem conta?{" "}
            <a href="/login" className="text-[#1a3c34] font-medium hover:underline">
              Fazer login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}