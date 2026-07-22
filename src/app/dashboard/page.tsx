"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import MonthCard from "@/components/calendar/MonthCard";
import ScaleEditor from "@/components/calendar/ScaleEditor";
import { ptBR } from "@/lib/i18n/pt-BR";
import { Printer, Sparkles } from "lucide-react";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

function getProximosMeses(qtd: number) {
  const hoje = new Date();
  const meses: { mes: number; ano: number; label: string }[] = [];
  for (let i = 0; i < qtd; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    meses.push({
      mes: data.getMonth() + 1,
      ano: data.getFullYear(),
      label: `${data.toLocaleDateString("pt-BR", { month: "long" }).replace(/^[a-z]/, (l) => l.toUpperCase())} ${data.getFullYear()}`,
    });
  }
  return meses;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mesEditando, setMesEditando] = useState<{ mes: number; ano: number } | null>(null);

  const meses = getProximosMeses(6);

  useEffect(() => {
    const supabase = getClient();
    if (!supabase) {
      router.push("/login");
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#1a3c34] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Cabeçalho da página */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-[#1a3c34]">Escalas</h1>
          <p className="text-sm text-[#8b7d6b] mt-0.5">
            Gerencie as escalas da sua ILPI
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="border border-[#d4cdc0] text-[#555] text-sm font-medium rounded-lg px-4 py-2 hover:border-[#1a3c34] hover:text-[#1a3c34] transition flex items-center gap-2">
            <Printer size={14} strokeWidth={2} />
            Imprimir todas
          </button>
          <button className="bg-[#1a3c34] text-white text-sm font-medium rounded-lg px-5 py-2 hover:bg-[#143028] transition flex items-center gap-2">
            <Sparkles size={14} strokeWidth={2} />
            Gerar próximos meses
          </button>
        </div>
      </div>

      {/* Status / info bar */}
      <div className="bg-white rounded-xl border border-[#e8e2d4] px-5 py-3 mb-6 flex items-center flex-wrap gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-2 text-[#555]">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[#8b7d6b]">Status:</span> Todas as escalas em dia
        </span>
        <span className="text-[#8b7d6b]">•</span>
        <span className="text-[#555]">
          <span className="text-[#8b7d6b]">ILPI:</span> Residencial Norteza
        </span>
        <span className="text-[#8b7d6b]">•</span>
        <span className="text-[#555]">
          <span className="text-[#8b7d6b]">Colaboradores:</span> 8
        </span>
        <span className="text-[#8b7d6b]">•</span>
        <span className="text-[#555]">
          <span className="text-[#8b7d6b]">Convites pendentes:</span> 2
        </span>
      </div>

      {/* Lista de meses */}
      <div className="space-y-5">
        {meses.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#e8e2d4] px-5 py-8 text-center text-[#8b7d6b]">
            {ptBR.emptyStates.dashboard.noShiftsScheduledYet}
          </div>
        ) : (
          meses.map(({ mes, ano, label }) => (
            <MonthCard
              key={`${mes}-${ano}`}
              mes={mes}
              ano={ano}
              onEditar={() => setMesEditando({ mes, ano })}
              onGerar={() => alert(`Gerar escala de ${label}`)}
            />
          ))
        )}
      </div>

      {/* Editor de escala (modal) */}
      <ScaleEditor
        mes={mesEditando?.mes ?? 1}
        ano={mesEditando?.ano ?? 2026}
        aberto={mesEditando !== null}
        onFechar={() => setMesEditando(null)}
      />
    </>
  );
}