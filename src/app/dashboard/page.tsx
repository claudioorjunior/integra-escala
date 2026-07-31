"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLocalUser, signOut } from "@/lib/auth";
import { getDB, buscarEscalaDoMes } from "@/lib/db";
import MonthCard from "@/components/calendar/MonthCard";
import ScaleEditor from "@/components/calendar/ScaleEditor";
import AppShell from "@/components/layout/AppShell";
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

const CORES_PALETA = ["#1a3c34", "#c4b998", "#8b5e3c", "#5a7a6a", "#a0522d", "#6b8e7a", "#8b7355", "#556b5a"];

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mesEditando, setMesEditando] = useState<{ mes: number; ano: number; gerar: boolean } | null>(null);
  
  const [ilpiInfo, setIlpiInfo] = useState<{ nome: string; colaboradoresCount: number } | null>(null);
  const [escalasPorMes, setEscalasPorMes] = useState<Record<string, any[]>>({});

  const meses = getProximosMeses(6);

  async function carregarDados() {
    const user = await getLocalUser();
    if (!user) {
      await signOut();
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

        // Buscar nome da ILPI, quantidade de colaboradores e lista de colaboradores em paralelo
        const [ilpiRes, colabCountRes, colabsRes] = await Promise.all([
          db.query<{ nome: string }>(
            `SELECT nome FROM public.ilpis WHERE id = $1;`,
            [ilpiId]
          ),
          db.query<{ count: string }>(
            `SELECT count(*) FROM public.colaboradores WHERE ilpi_id = $1;`,
            [ilpiId]
          ),
          db.query<any>(
            `SELECT c.id, c.nome, COALESCE(k.nome, 'Cuidador') AS cargo
             FROM public.colaboradores c
             LEFT JOIN public.cargos k ON k.id = c.cargo_id
             WHERE c.ilpi_id = $1
             ORDER BY c.nome;`,
            [ilpiId]
          ),
        ]);

        const colabMap: Record<string, { nome: string; cargo: string; cor: string }> = {};
        colabsRes.rows.forEach((c: any, index: number) => {
          colabMap[c.id] = {
            nome: c.nome.split(" ")[0],
            cargo: c.cargo || "sem cargo",
            cor: CORES_PALETA[index % CORES_PALETA.length],
          };
        });

        setIlpiInfo({
          nome: ilpiRes.rows[0]?.nome || "Minha ILPI",
          colaboradoresCount: parseInt(colabCountRes.rows[0]?.count || "0", 10),
        });

        // Buscar escalas de todos os meses exibidos em paralelo
        const resultadosMeses = await Promise.all(
          meses.map(async (m) => ({
            chave: `${m.mes}-${m.ano}`,
            escala: await buscarEscalaDoMes(user.id, m.mes, m.ano),
          }))
        );

        const novasEscalas: Record<string, any[]> = {};
        for (const { chave, escala } of resultadosMeses) {
          if (escala.plantoes.length > 0) {
            // Agrupar por dia
            const plantoesAgrupados: Record<number, any[]> = {};
            escala.plantoes.forEach((p) => {
              if (!plantoesAgrupados[p.dia]) plantoesAgrupados[p.dia] = [];
              const cInfo = colabMap[p.colaboradorId] || { nome: "Externo", cargo: "sem cargo", cor: "#999" };
              plantoesAgrupados[p.dia].push({
                nome: cInfo.nome,
                cargo: cInfo.cargo,
                horario: `${(p.horarioInicio ?? "07:00").slice(0, 5)}-${(p.horarioFim ?? "19:00").slice(0, 5)}`,
                cor: cInfo.cor,
              });
            });

            const diasEscala = Object.entries(plantoesAgrupados).map(([diaStr, plantoesList]) => ({
              dia: parseInt(diaStr, 10),
              plantoes: plantoesList,
            }));

            novasEscalas[chave] = diasEscala;
          } else {
            novasEscalas[chave] = [];
          }
        }
        setEscalasPorMes(novasEscalas);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do dashboard local:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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
    <AppShell>
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
        <span className="text-[#555]">
          <span className="text-[#8b7d6b]">ILPI:</span> {ilpiInfo?.nome || "Carregando..."}
        </span>
        <span className="text-[#8b7d6b]">•</span>
        <span className="text-[#555]">
          <span className="text-[#8b7d6b]">Colaboradores:</span> {ilpiInfo?.colaboradoresCount ?? 0}
        </span>
      </div>

      {/* Lista de meses */}
      <div className="space-y-5">
        {meses.map(({ mes, ano, label }) => {
          const chave = `${mes}-${ano}`;
          const diasReais = escalasPorMes[chave];
          
          return (
            <MonthCard
              key={chave}
              mes={mes}
              ano={ano}
              dias={diasReais && diasReais.length > 0 ? diasReais : undefined}
              onEditar={() => setMesEditando({ mes, ano, gerar: false })}
              onGerar={() => setMesEditando({ mes, ano, gerar: true })}
            />
          );
        })}
      </div>

      {/* Editor de escala (modal) */}
      {mesEditando && (
        <ScaleEditor
          key={`${mesEditando.mes}-${mesEditando.ano}`}
          mes={mesEditando.mes}
          ano={mesEditando.ano}
          aberto
          gerarAoAbrir={mesEditando.gerar}
          onFechar={() => setMesEditando(null)}
          onSalvo={carregarDados}
        />
      )}
      </AppShell>
  );
}