"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth";

export default function DevLoginPage() {
  const router = useRouter();
  const [trying, setTrying] = useState(true);

  useEffect(() => {
    async function autoLogin() {
      try {
        await signIn("dev@test.com", "dev123");
        router.push("/dashboard");
        router.refresh();
      } catch {
        setTrying(false);
      }
    }
    autoLogin();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f1a16]">
      <div className="text-center">
        {trying ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-[#1a3c34] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#8b7d6b] text-sm">Entrando como dev...</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-red-400 text-sm mb-4">
              Falha no login automático. Tente novamente.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="bg-[#1a3c34] text-white px-4 py-2 rounded-lg text-sm"
            >
              Voltar para login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}