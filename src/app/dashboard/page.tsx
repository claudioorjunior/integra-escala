"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLocalUser } from "@/lib/auth";
import { getDB } from "@/lib/db";
import MonthCard from "@/components/calendar/MonthCard";
import ScaleEditor from "@/components/calendar/ScaleEditor";
import { Plus, Printer, Sparkles } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [mesEditando, setMesEditando] = useState<{ mes: number; ano: number } | null>(null);
  
  const [ilpiInfo, setIlpiInfo] = useState<{ nome: string; colaboradoresCount: number } | null>(null);

  const meses = getProximosMeses(6);

  useEffect(() => {
    async function carregarDados() {
      const user = await getLocalUser();
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const db = await getDB();
        
        // 1. Pegar a ILPI
        const uiRes = await db.query<{ ilpi_id: string }>(
          `SELECT ilpi_id FROM public.usuario_ilpi WHERE usuario_id = $1 LIMIT 1;`,
          [user.id]
        );

        if (uiRes.rows.length > 0) {
          const ilpiId = uiRes.rows[0].ilpi_id;
          
          // Buscar nome da ILPI
          const ilpiRes = await db.query<{ nome: string }>(
            `SELECT nome FROM public.ilpis WHERE id = $1;`,
            [ilpiId]
          );
          
          // Buscar quantidade de colaboradores
          const colabCountRes = await db.query<{ count: string }>(
            `SELECT count(*) FROM public.colaboradores WHERE ilpi_id = $1;`,
            [ilpiId]
          );

          setIlpiInfo({
            nome: ilpiRes.rows[0]?.nome || "Minha ILPI",
            colaboradoresCount: parseInt(colabCountRes.rows[0]?.count || "0", 10),
          });
        }
      } catch (err) {
        console.error("Erro ao carregar dados do dashboard local:", err);
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
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
          <span className="text-[#8b7d6b]">ILPI:</span> {ilpiInfo?.nome || "Carregando..."}
        </span>
        <span className="text-[#8b7d6b]">•</span>
        <span className="text-[#555]">
          <span className="text-[#8b7d6b]">Colaboradores:</span> {ilpiInfo?.colaboradoresCount ?? 0}
        </span>
        <span className="text-[#8b7d6b]">•</span>
        <span className="text-[#555]">
          <span className="text-[#8b7d6b]">Convites pendentes:</span> 0
        </span>
      </div>

      {/* Lista de meses */}
      <div className="space-y-5">
        {meses.map(({ mes, ano, label }) => (
          <MonthCard
            key={`${mes}-${ano}`}
            mes={mes}
            ano={ano}
            onEditar={() => setMesEditando({ mes, ano })}
            onGerar={() => alert(`Gerar escala de ${label}`)}
          />
        ))}
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