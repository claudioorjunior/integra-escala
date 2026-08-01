"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLocalUser, signOut } from "@/lib/auth";
import {
  getDB,
  getIlpiIdDoUsuario,
  buscarEscalaDoMes,
  salvarEscalaDoMes,
  type PlantaoDB,
} from "@/lib/db";
import {
  gerarEscala,
  normalizarRegime,
  type Colaborador as ColaboradorEscala,
  type Aviso,
} from "@/lib/scheduling";
import { agruparPlantoesPorDia } from "@/lib/scheduling/visualization";
import MonthCard from "@/components/calendar/MonthCard";
import ScaleEditor from "@/components/calendar/ScaleEditor";
import { Plus, Printer, Sparkles, X } from "lucide-react";

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

function totalDiasDoMes(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate();
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [mesEditando, setMesEditando] = useState<{ mes: number; ano: number } | null>(null);

  const [ilpiInfo, setIlpiInfo] = useState<{ nome: string; colaboradoresCount: number } | null>(null);
  const [escalasPorMes, setEscalasPorMes] = useState<Record<string, any[]>>({});
  const [avisosGeracao, setAvisosGeracao] = useState<Aviso[]>([]);

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
            `SELECT id, nome FROM public.colaboradores WHERE ilpi_id = $1 ORDER BY nome;`,
            [ilpiId]
          ),
        ]);

        const colabMap: Record<string, { nome: string; cor: string }> = {};
        colabsRes.rows.forEach((c: any, index: number) => {
          colabMap[c.id] = {
            nome: c.nome.split(" ")[0],
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
          novasEscalas[chave] =
            escala.plantoes.length > 0
              ? agruparPlantoesPorDia(escala.plantoes, colabMap)
              : [];
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

  async function handleGerarProximosMeses() {
    if (gerando) return;
    const user = await getLocalUser();
    if (!user) return;

    const pendentes = meses.filter(
      ({ mes, ano }) => (escalasPorMes[`${mes}-${ano}`] ?? []).length === 0
    );
    if (pendentes.length === 0) {
      setAvisosGeracao([
        { tipo: "dia_descoberto", mensagem: "Todos os meses exibidos já possuem escala." },
      ]);
      return;
    }
    if (
      !confirm(
        `Gerar escala automaticamente para ${pendentes.length} ${pendentes.length === 1 ? "mês" : "meses"} sem escala?`
      )
    ) {
      return;
    }

    setGerando(true);
    setAvisosGeracao([]);
    try {
      const db = await getDB();
      const ilpiId = await getIlpiIdDoUsuario(db, user.id);
      if (!ilpiId) throw new Error("Usuário não vinculado a nenhuma ILPI.");

      const colabsRes = await db.query<any>(
        `SELECT c.id, c.nome, c.regime, cg.nome as cargo
         FROM public.colaboradores c
         LEFT JOIN public.cargos cg ON cg.id = c.cargo_id
         WHERE c.ilpi_id = $1 AND c.ativo = true
         ORDER BY c.nome;`,
        [ilpiId]
      );

      const colaboradores: ColaboradorEscala[] = colabsRes.rows.map((row: any) => ({
        id: row.id,
        nome: row.nome,
        cargoId: null,
        cargoNome: row.cargo || "Sem cargo",
        regime: normalizarRegime(row.regime) ?? "5x2",
      }));

      if (colaboradores.length === 0) {
        setAvisosGeracao([
          { tipo: "colaborador_sem_regime", mensagem: "Nenhum colaborador ativo cadastrado. Cadastre na aba Colaboradores." },
        ]);
        return;
      }

      const avisos: Aviso[] = [];
      for (const { mes, ano } of pendentes) {
        const resultado = gerarEscala({
          mes,
          ano,
          colaboradores,
          manterAjustesManuais: false,
          seed: mes + ano * 100,
        });

        const plantoesDB: PlantaoDB[] = [];
        const totalDias = totalDiasDoMes(mes, ano);
        for (let dia = 1; dia <= totalDias; dia++) {
          for (const p of resultado.plantoes[dia] ?? []) {
            plantoesDB.push({
              colaboradorId: p.colaboradorId,
              dia,
              horarioInicio: p.horario.inicio,
              horarioFim: p.horario.fim,
            });
          }
        }
        await salvarEscalaDoMes(user.id, mes, ano, plantoesDB, "rascunho");
        avisos.push(...resultado.avisos);
      }

      setAvisosGeracao(avisos);
      await carregarDados();
    } catch (err) {
      console.error("Erro ao gerar próximos meses:", err);
      setAvisosGeracao([
        { tipo: "sub_cobertura", mensagem: "Não foi possível gerar as escalas. Tente novamente." },
      ]);
    } finally {
      setGerando(false);
    }
  }

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
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-xl font-medium text-[#1a3c34]">Escalas</h1>
          <p className="text-sm text-[#8b7d6b] mt-0.5">
            Gerencie as escalas da sua ILPI
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="border border-[#d4cdc0] text-[#555] text-sm font-medium rounded-lg px-4 py-2 hover:border-[#1a3c34] hover:text-[#1a3c34] transition flex items-center gap-2"
          >
            <Printer size={14} strokeWidth={2} />
            Imprimir todas
          </button>
          <button
            onClick={handleGerarProximosMeses}
            disabled={gerando}
            className="bg-[#1a3c34] text-white text-sm font-medium rounded-lg px-5 py-2 hover:bg-[#143028] transition flex items-center gap-2 disabled:opacity-50"
          >
            <Sparkles size={14} strokeWidth={2} />
            {gerando ? "Gerando..." : "Gerar próximos meses"}
          </button>
        </div>
      </div>

      {/* Status / info bar */}
      <div className="bg-white rounded-xl border border-[#e8e2d4] px-5 py-3 mb-6 flex items-center flex-wrap gap-x-6 gap-y-2 text-sm print:hidden">
        <span className="text-[#555]">
          <span className="text-[#8b7d6b]">ILPI:</span> {ilpiInfo?.nome || "Carregando..."}
        </span>
        <span className="text-[#8b7d6b]">•</span>
        <span className="text-[#555]">
          <span className="text-[#8b7d6b]">Colaboradores:</span> {ilpiInfo?.colaboradoresCount ?? 0}
        </span>
      </div>

      {/* Avisos da geração em massa */}
      {avisosGeracao.length > 0 && (
        <div className="mb-6 space-y-1 print:hidden">
          {avisosGeracao.map((a, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1"
            >
              <span className="font-medium">{a.tipo}:</span>
              <span className="flex-1">{a.mensagem}</span>
              <button
                onClick={() => setAvisosGeracao(avisosGeracao.filter((_, j) => j !== i))}
                className="text-amber-600 hover:text-amber-800"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

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
              onEditar={() => setMesEditando({ mes, ano })}
              onGerar={() => setMesEditando({ mes, ano })}
            />
          );
        })}
      </div>

      {/* Editor de escala (modal) */}
      <ScaleEditor
        mes={mesEditando?.mes ?? 1}
        ano={mesEditando?.ano ?? 2026}
        aberto={mesEditando !== null}
        onFechar={() => setMesEditando(null)}
        onSalvo={carregarDados}
      />
    </>
  );
}
