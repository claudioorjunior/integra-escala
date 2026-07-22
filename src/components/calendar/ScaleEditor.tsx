"use client";

import { useMemo } from "react";
import {
  X,
  Sparkles,
  Printer,
  Trash2,
  Save,
} from "lucide-react";
import MonthCard from "./MonthCard";

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
}

function getTotalDias(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate();
}

function getDiaSemana(dia: number, mes: number, ano: number) {
  return new Date(ano, mes -1, dia).getDay();
}

// Mock para demonstração — depois vem do banco
function gerarMockColaboradores() {
  return [
    { nome: "Fátima Silva", cargo: "Cuidador", regime: "24/72", cor: "#1a3c34" },
    { nome: "Maria Souza", cargo: "Técnico Enfermagem", regime: "5x2 (8h)", cor: "#c4b998" },
    { nome: "João Costa", cargo: "Noturnista", regime: "12x36", cor: "#8b5e3c" },
    { nome: "Carlos Pereira", cargo: "Cuidador", regime: "24/72", cor: "#5a7a6a" },
    { nome: "Ana Oliveira", cargo: "Noturnista", regime: "12x36", cor: "#a0522d" },
    { nome: "José Santos", cargo: "Diarista", regime: "5x2 (8h)", cor: "#6b8e7a" },
    { nome: "Rita Lima", cargo: "Técnico Enfermagem", regime: "5x2 (8h)", cor: "#8b7355" },
    { nome: "Lúcia Mendes", cargo: "Técnico Enfermagem", regime: "5x2 (8h)", cor: "#556b5a" },
  ];
}

function gerarMockTurnos(mes: number, ano: number) {
  const colaboradores = gerarMockColaboradores();
  const totalDias = getTotalDias(mes, ano);
  const turnos: Record<string, { nome: string; horario: string; cor: string }[]> = {};

  for (let d = 1; d <= totalDias; d++) {
    const qtd = 1 + Math.floor(Math.random() * Math.min(4, colaboradores.length));
    const selecionados = colaboradores.sort(() => Math.random() - 0.5).slice(0, qtd);
    turnos[d] = selecionados.map((c) => ({
      nome: c.nome,
      horario:
        c.regime === "24/72"
          ? "Plantão 24h"
          : c.regime === "12x36"
          ? "19h às 07h"
          : ["07h às 15h", "07h às 17h", "13h às 21h"][Math.floor(Math.random() * 3)],
      cor: c.cor,
    }));
  }

  return { colaboradores, turnos };
}

export default function ScaleEditor({
  mes,
  ano,
  aberto,
  onFechar,
}: ScaleEditorProps) {
  const data = useMemo(() => gerarMockTurnos(mes, ano), [mes, ano]);

  const totalDias = getTotalDias(mes, ano);
  const primeiroDiaSemana = getDiaSemana(1, mes, ano);

  const celulas = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < primeiroDiaSemana; i++) cells.push(null);
    for (let d = 1; d <= totalDias; d++) cells.push(d);
    return cells;
  }, [totalDias, primeiroDiaSemana]);

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
                Arraste para trocar, clique para editar
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="bg-[#1a3c34] text-white text-sm font-medium rounded-lg px-5 py-2 hover:bg-[#143028] transition flex items-center gap-2">
                <Sparkles size={14} strokeWidth={2} />
                Gerar Escala
              </button>
              <button className="border border-[#d4cdc0] text-[#555] text-sm font-medium rounded-lg px-4 py-2 hover:border-[#1a3c34] hover:text-[#1a3c34] transition flex items-center gap-2">
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
              <span className="font-medium text-[#555]">Colaboradores:</span>
              {data.colaboradores.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: c.cor }}
                  />
                  {c.nome}
                  <span className="text-[#8b7d6b]">({c.regime})</span>
                </span>
              ))}
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
              {Array.from({ length: Math.ceil(celulas.filter(Boolean).length / 7) }, (_, semana) => {
                const start = semana * 7;
                const semanaDias = celulas.slice(start, start + 7);
                return (
                  <div key={semana}>
                    {data.colaboradores.map((colab, iColab) => (
                      <div
                        key={`${semana}-${iColab}`}
                        className="grid grid-cols-[160px_repeat(7,1fr)] gap-px bg-[#e8e2d4]"
                      >
                        {/* Nome do colaborador */}
                        <div className="bg-white px-3 py-2 text-sm flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: colab.cor }}
                          />
                          <span className="truncate text-[#333]">{colab.nome}</span>
                        </div>

                        {/* Dias da semana */}
                        {semanaDias.map((dia, iDia) => {
                          if (dia === null) {
                            return (
                              <div
                                key={`${iColab}-${iDia}`}
                                className="bg-[#f5f3ee] min-h-[36px]"
                              />
                            );
                          }

                          const turno = data.turnos[dia]?.[iColab % (data.turnos[dia]?.length || 1)];
                          const isFimDeSemana = getDiaSemana(dia, mes, ano) === 0;

                          return (
                            <div
                              key={`${iColab}-${dia}`}
                              className={`bg-white px-1 py-1 text-[11px] leading-tight min-h-[36px] cursor-pointer transition-colors hover:bg-[#f0ede5] ${
                                isFimDeSemana ? "bg-[#faf8f4]" : ""
                              }`}
                              title={`${colab.nome} - Dia ${dia}`}
                            >
                              <span className="text-[9px] text-[#8b7d6b] font-medium">
                                {dia}
                              </span>
                              {turno && Math.random() > 0.4 && (
                                <div
                                  className="mt-0.5 text-[10px] px-1 py-0.5 rounded"
                                  style={{
                                    backgroundColor: `${colab.cor}15`,
                                    color: colab.cor,
                                  }}
                                >
                                  {colab.nome.split(" ")[0]}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Rodapé da tabela */}
              <div className="grid grid-cols-[160px_repeat(7,1fr)] gap-px bg-[#e8e2d4] rounded-b-lg overflow-hidden">
                <div className="bg-[#f5f3ee] px-3 py-2 text-xs font-medium text-[#8b7d6b]">
                  Total
                </div>
                {DIAS_SEMANA.map((d, i) => (
                  <div
                    key={d}
                    className={`bg-[#f5f3ee] px-2 py-2 text-center text-xs text-[#8b7d6b] ${
                      i === 0 ? "text-red-400" : ""
                    }`}
                  >
                    ~{data.colaboradores.length}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ações finais */}
          <div className="px-6 py-4 border-t border-[#e8e2d4] bg-[#faf8f4] flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-[#8b7d6b]">
              <span>Status: <span className="text-amber-600 font-medium">Rascunho</span></span>
              <span>•</span>
              <span>Total de colaboradores: {data.colaboradores.length}</span>
              <span>•</span>
              <span>Dias: {totalDias}</span>
            </div>
            <div className="flex gap-2">
              <button className="text-sm text-[#8b7d6b] hover:text-red-600 transition px-3 py-1.5 flex items-center gap-2">
                <Trash2 size={14} strokeWidth={2} />
                Descartar
              </button>
              <button className="bg-[#1a3c34] text-white text-sm font-medium rounded-lg px-5 py-1.5 hover:bg-[#143028] transition flex items-center gap-2">
                <Save size={14} strokeWidth={2} />
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}