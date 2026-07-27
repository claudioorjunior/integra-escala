"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Sparkles, Printer, Trash2, Save } from "lucide-react";
import { getLocalUser } from "@/lib/auth";
import { getDB, buscarEscalaDoMes, salvarEscalaDoMes, excluirEscalaDoMes, PlantaoDB } from "@/lib/db";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface ScaleEditorProps {
  mes: number;
  ano: number;
  aberto: boolean;
  onFechar: () => void;
  onSalvo?: () => void;
}

interface Colaborador {
  id: string;
  nome: string;
  cargo: string;
  regime: string;
  cor: string;
}

const CORES_PALETA = ["#1a3c34", "#c4b998", "#8b5e3c", "#5a7a6a", "#a0522d", "#6b8e7a", "#8b7355", "#556b5a"];

function getTotalDias(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate();
}

function getDiaSemana(dia: number, mes: number, ano: number) {
  return new Date(ano, mes - 1, dia).getDay();
}

export default function ScaleEditor({
  mes,
  ano,
  aberto,
  onFechar,
  onSalvo,
}: ScaleEditorProps) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [plantoes, setPlantoes] = useState<Record<number, Record<string, string>>>({});
  const [status, setStatus] = useState<"rascunho" | "publicada">("rascunho");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const totalDias = getTotalDias(mes, ano);
  const primeiroDiaSemana = getDiaSemana(1, mes, ano);

  const celulas = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < primeiroDiaSemana; i++) cells.push(null);
    for (let d = 1; d <= totalDias; d++) cells.push(d);
    return cells;
  }, [totalDias, primeiroDiaSemana]);

  useEffect(() => {
    if (!aberto) return;

    async function carregarDados() {
      const user = await getLocalUser();
      if (!user) return;

      setLoading(true);
      try {
        const db = await getDB();
        
        // 1. Carregar colaboradores reais
        const uiRes = await db.query<{ ilpi_id: string }>(
          `SELECT ilpi_id FROM public.usuario_ilpi WHERE usuario_id = $1 LIMIT 1;`,
          [user.id]
        );
        if (uiRes.rows.length === 0) return;
        const ilpiId = uiRes.rows[0].ilpi_id;

        const colabsRes = await db.query<any>(
          `SELECT c.id, c.nome, c.regime, cg.nome as cargo 
           FROM public.colaboradores c
           LEFT JOIN public.cargos cg ON cg.id = c.cargo_id
           WHERE c.ilpi_id = $1 AND c.ativo = true
           ORDER BY c.nome;`,
          [ilpiId]
        );

        const colabsMapped: Colaborador[] = colabsRes.rows.map((row: any, i: number) => ({
          id: row.id,
          nome: row.nome,
          cargo: row.cargo || "Sem cargo",
          regime: row.regime || "Não definido",
          cor: CORES_PALETA[i % CORES_PALETA.length],
        }));
        setColaboradores(colabsMapped);

        // 2. Carregar escala salva
        const escala = await buscarEscalaDoMes(user.id, mes, ano);
        setStatus(escala.status as any || "rascunho");

        const plantoesRecord: Record<number, Record<string, string>> = {};
        for (const p of escala.plantoes) {
          if (!plantoesRecord[p.dia]) plantoesRecord[p.dia] = {};
          // Reconstrói o intervalo "HH:MM-HH:MM" a partir das colunas TIME do banco
          const inicio = (p.horarioInicio ?? "07:00").slice(0, 5);
          const fim = (p.horarioFim ?? "19:00").slice(0, 5);
          plantoesRecord[p.dia][p.colaboradorId] = `${inicio}-${fim}`;
        }
        setPlantoes(plantoesRecord);
      } catch (err) {
        console.error("Erro ao carregar escala:", err);
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
  }, [mes, ano, aberto]);

  // Algoritmo simples de geração automática
  function handleGerarEscala() {
    const temDados = Object.values(plantoes).some((d) => Object.keys(d).length > 0);
    if (temDados && !confirm("Gerar a escala substituirá os plantões atuais deste mês. Continuar?")) return;
    const novosPlantoes: Record<number, Record<string, string>> = {};

    for (let d = 1; d <= totalDias; d++) {
      novosPlantoes[d] = {};
      const diaSemana = getDiaSemana(d, mes, ano);
      const isFimDeSemana = diaSemana === 0 || diaSemana === 6;

      colaboradores.forEach((colab, i) => {
        // Regra simples:
        // - Cuidador 24/72: trabalha a cada 4 dias (usamos o dia + index % 4)
        // - Noturnista 12x36: trabalha dia sim dia não (dia + index % 2)
        // - Outros cargos / 5x2: trabalha apenas em dias de semana (seg-sex)
        if (colab.regime.includes("24/72")) {
          if ((d + i) % 4 === 0) {
            novosPlantoes[d][colab.id] = "07:00-07:00";
          }
        } else if (colab.regime.includes("12x36")) {
          if ((d + i) % 2 === 0) {
            novosPlantoes[d][colab.id] = "19:00-07:00";
          }
        } else if (colab.regime.includes("5x2") || colab.regime.includes("8h")) {
          if (!isFimDeSemana) {
            novosPlantoes[d][colab.id] = "08:00-17:00";
          }
        } else {
          // Fallback para preencher algo
          if (d % 3 === 0) {
            novosPlantoes[d][colab.id] = "07:00-15:00";
          }
        }
      });
    }

    setPlantoes(novosPlantoes);
  }

  // Alternar turno ao clicar na célula
  function toggleCélula(dia: number, colabId: string, regime: string) {
    setPlantoes((prev) => {
      const copy = { ...prev, [dia]: { ...(prev[dia] ?? {}) } };
      const atual = copy[dia][colabId];
      if (!atual) {
        // Define horário padrão baseado no regime
        copy[dia][colabId] = regime.includes("12x36")
          ? "19:00-07:00"
          : regime.includes("24/72")
          ? "07:00-07:00"
          : "08:00-17:00";
      } else {
        // Remove o plantão daquele dia
        delete copy[dia][colabId];
      }
      return copy;
    });
  }

  async function handleSalvar() {
    const user = await getLocalUser();
    if (!user) return;

    setLoading(true);
    setErro(null);
    try {
      const plantoesDB: PlantaoDB[] = [];
      Object.entries(plantoes).forEach(([diaStr, colabs]) => {
        const dia = parseInt(diaStr, 10);
        Object.entries(colabs).forEach(([colabId, horario]) => {
          const [inicio, fim] = horario.split("-");
          plantoesDB.push({
            colaboradorId: colabId,
            dia,
            horarioInicio: inicio || "07:00",
            horarioFim: fim || "19:00",
          });
        });
      });

      await salvarEscalaDoMes(user.id, mes, ano, plantoesDB, status);
      if (onSalvo) onSalvo();
      onFechar();
    } catch (err) {
      console.error("Erro ao salvar escala:", err);
      setErro("Não foi possível salvar a escala. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDescartar() {
    if (!confirm("Tem certeza que deseja excluir esta escala? Isso apagará todos os plantões do mês.")) return;
    const user = await getLocalUser();
    if (!user) return;

    setLoading(true);
    setErro(null);
    try {
      await excluirEscalaDoMes(user.id, mes, ano);
      setPlantoes({});
      if (onSalvo) onSalvo();
      onFechar();
    } catch (err) {
      console.error("Erro ao descartar escala:", err);
      setErro("Não foi possível descartar a escala. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl mx-4 my-6">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e2d4]">
            <div>
              <h2 className="text-lg font-medium text-[#1a3c34]">
                {MESES[mes - 1]} {ano}
              </h2>
              <p className="text-xs text-[#8b7d6b] mt-0.5">
                Clique nas células para alternar a escala do colaborador
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGerarEscala}
                disabled={loading}
                className="bg-[#1a3c34] text-white text-sm font-medium rounded-lg px-5 py-2 hover:bg-[#143028] transition flex items-center gap-2 disabled:opacity-50"
              >
                <Sparkles size={14} strokeWidth={2} />
                Gerar Escala
              </button>
              <button
                onClick={() => window.print()}
                className="border border-[#d4cdc0] text-[#555] text-sm font-medium rounded-lg px-4 py-2 hover:border-[#1a3c34] hover:text-[#1a3c34] transition flex items-center gap-2"
              >
                <Printer size={14} strokeWidth={2} />
                Imprimir
              </button>
              <button
                onClick={onFechar}
                className="text-[#8b7d6b] hover:text-[#555] p-2"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Legenda */}
          <div className="px-6 py-3 border-b border-[#e8e2d4] bg-[#faf8f4]">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="font-medium text-[#555]">Colaboradores ativos:</span>
              {colaboradores.map((c) => (
                <span key={c.id} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: c.cor }}
                  />
                  {c.nome}
                  <span className="text-[#8b7d6b]">({c.regime})</span>
                </span>
              ))}
              {colaboradores.length === 0 && (
                <span className="text-red-500">Nenhum colaborador ativo cadastrado. Cadastre primeiro na aba Colaboradores.</span>
              )}
            </div>
          </div>

          {/* Tabela de escala */}
          <div className="overflow-x-auto">
            <div className="min-w-[900px] p-4">
              {/* Header dos dias */}
              <div className="grid grid-cols-[160px_repeat(7,1fr)] gap-px bg-[#e8e2d4] rounded-t-lg overflow-hidden">
                <div className="bg-[#f5f3ee] px-3 py-2 text-xs font-medium text-[#8b7d6b]">
                  Colaborador
                </div>
                {DIAS_SEMANA.map((d, i) => (
                  <div
                    key={d}
                    className={`bg-[#f5f3ee] px-2 py-2 text-center text-xs font-medium uppercase tracking-wider ${
                      i === 0 ? "text-red-400" : "text-[#8b7d6b]"
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Semanas */}
              {Array.from({ length: Math.ceil(celulas.length / 7) }, (_, semana) => {
                const start = semana * 7;
                const semanaDias = celulas.slice(start, start + 7);
                return (
                  <div key={semana} className="border-b border-[#e8e2d4]/40">
                    {colaboradores.map((colab) => (
                      <div
                        key={`${semana}-${colab.id}`}
                        className="grid grid-cols-[160px_repeat(7,1fr)] gap-px bg-[#e8e2d4]/40"
                      >
                        {/* Nome do colaborador */}
                        <div className="bg-white px-3 py-2 text-sm flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: colab.cor }}
                          />
                          <span className="truncate text-[#333] font-medium">{colab.nome}</span>
                        </div>

                        {/* Dias da semana */}
                        {semanaDias.map((dia, iDia) => {
                          if (dia === null) {
                            return (
                              <div
                                key={`empty-${iDia}`}
                                className="bg-[#f5f3ee] min-h-[38px]"
                              />
                            );
                          }

                          const turno = plantoes[dia]?.[colab.id];
                          const isFimDeSemana = getDiaSemana(dia, mes, ano) === 0 || getDiaSemana(dia, mes, ano) === 6;

                          return (
                            <button
                              type="button"
                              key={`${colab.id}-${dia}`}
                              onClick={() => toggleCélula(dia, colab.id, colab.regime)}
                              aria-pressed={Boolean(turno)}
                              aria-label={`${colab.nome} — dia ${dia}${turno ? `, ${turno}` : ", sem plantão"}`}
                              className={`bg-white px-1 py-1 text-[11px] leading-tight min-h-[38px] cursor-pointer transition-colors hover:bg-[#f0ede5] ${
                                isFimDeSemana ? "bg-[#faf8f4]" : ""
                              }`}
                              title={`${colab.nome} - Dia ${dia}`}
                            >
                              <span className="text-[9px] text-[#8b7d6b] font-medium">
                                {dia}
                              </span>
                              {turno && (
                                <div
                                  className="mt-0.5 text-[9px] px-1 py-0.5 rounded text-center truncate font-medium"
                                  style={{
                                    backgroundColor: `${colab.cor}20`,
                                    color: colab.cor,
                                  }}
                                >
                                  {turno}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ações finais */}
          <div className="px-6 py-4 border-t border-[#e8e2d4] bg-[#faf8f4] flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-[#8b7d6b]">
              <div className="flex items-center gap-1.5">
                <span>Status:</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="px-2 py-0.5 border border-[#d4cdc0] rounded bg-white text-xs"
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="publicada">Publicada</option>
                </select>
              </div>
              <span>•</span>
              <span>Total de colaboradores: {colaboradores.length}</span>
              <span>•</span>
              <span>Dias: {totalDias}</span>
            </div>
            <div className="flex items-center gap-3">
              {erro && (
                <span className="text-xs text-red-600 font-medium">{erro}</span>
              )}
              <button
                onClick={handleDescartar}
                disabled={loading}
                className="text-sm text-[#8b7d6b] hover:text-red-600 transition px-3 py-1.5 flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 size={14} strokeWidth={2} />
                Descartar
              </button>
              <button
                onClick={handleSalvar}
                disabled={loading}
                className="bg-[#1a3c34] text-white text-sm font-medium rounded-lg px-5 py-1.5 hover:bg-[#143028] transition flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={14} strokeWidth={2} />
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
