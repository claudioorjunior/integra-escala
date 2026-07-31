"use client";

import { useState, useMemo } from "react";
import { Pencil, Sparkles, X } from "lucide-react";
import Modal from "@/components/ui/Modal";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Plantao {
  nome: string;
  cargo: string;
  horario: string;
  cor: string;
}

interface DiaEscala {
  dia: number;
  plantoes: Plantao[];
}

interface MonthCardProps {
  mes: number;
  ano: number;
  dias?: DiaEscala[];
  onEditar?: () => void;
  onGerar?: () => void;
}

function obterDiaDaAbreviado(dia: number, mes: number, ano: number) {
  return new Date(ano, mes - 1, dia).getDay();
}

function getTotalDias(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate();
}

export default function MonthCard({
  mes,
  ano,
  dias: diasProp,
  onEditar,
  onGerar,
}: MonthCardProps) {
  const [diaDetalhe, setDiaDetalhe] = useState<number | null>(null);
  const dias = diasProp;
  const totalDias = getTotalDias(mes, ano);
  const primeiroDiaDaAbreviado = obterDiaDaAbreviado(1, mes, ano);

  const diasMap = useMemo(() => {
    const map = new Map<number, Plantao[]>();
    (dias ?? []).forEach((d) => map.set(d.dia, d.plantoes));
    return map;
  }, [dias]);

  // Contar colaboradores unicos neste mes
  const colaboradoresNoMes = useMemo(() => {
    const nomes = new Set<string>();
    (dias ?? []).forEach((d) => d.plantoes.forEach((p) => nomes.add(p.nome)));
    return nomes.size;
  }, [dias]);

  // Gera as celulas do calendario
  const celulas = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < primeiroDiaDaAbreviado; i++) cells.push(null);
    for (let d = 1; d <= totalDias; d++) cells.push(d);
    return cells;
  }, [totalDias, primeiroDiaDaAbreviado]);

  return (
    <div
      className="bg-white rounded-xl border border-[#e8e2d4] overflow-hidden transition-shadow hover:shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e2d4]">
        <div>
          <h3 className="text-lg font-medium text-[#1a3c34]">
            {MESES[mes - 1]} {ano}
          </h3>
          <p className="text-sm text-[#8b7d6b] mt-0.5">
            {colaboradoresNoMes} colaboradores escalados
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onGerar && (
            <button
              onClick={onGerar}
              className="text-sm font-medium bg-[#1a3c34] text-white rounded-lg px-4 py-2 hover:bg-[#143028] transition flex items-center gap-2"
            >
              <Sparkles size={14} strokeWidth={2} />
              Gerar
            </button>
          )}
          {onEditar && (
            <button
              onClick={onEditar}
              className="text-sm font-medium border border-[#d4cdc0] text-[#555] rounded-lg px-4 py-2 hover:border-[#1a3c34] hover:text-[#1a3c34] transition flex items-center gap-2"
            >
              <Pencil size={14} strokeWidth={2} />
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Informacoes do mes */}
      <div className="px-5 py-3 border-b border-[#e8e2d4] bg-[#faf8f4]">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#8b7d6b]">
          {dias && dias.length > 0 ? (
            <span>Colaboradores escalados neste mês</span>
          ) : (
            <span>Nenhuma escala gerada para este mês</span>
          )}
          <span>•</span>
          <span>Total de {totalDias} dias</span>
        </div>
      </div>

      {/* Grid de dias */}
      <div className="p-4">
        {/* Dias da semana */}
        <div className="grid grid-cols-7 mb-2">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className={`text-center text-xs font-medium text-[#8b7d6b] uppercase tracking-wider py-1.5 ${
                d === "Dom" ? "text-red-400" : ""
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Celulas */}
        <div className="grid grid-cols-7 gap-1">
          {celulas.map((dia, i) => {
            if (dia === null) return <div key={`empty-${i}`} className="aspect-square" />;

            const plantoesDoDia = diasMap.get(dia);
            const diaDaAbreviado = obterDiaDaAbreviado(dia, mes, ano);
            const isFimDeAbreviado = diaDaAbreviado === 0 || diaDaAbreviado === 6;

            return (
              <div
                key={dia}
                className={`relative rounded p-1 min-h-[48px] flex flex-col items-center ${
                  isFimDeAbreviado ? "bg-[#faf8f4]" : ""
                }`}
              >
                <span
                  className={`text-xs leading-tight font-medium ${
                    diaDaAbreviado === 0 ? "text-red-400" : "text-[#555]"
                  }`}
                >
                  {dia}
                </span>
                {/* Nomes e horarios dos colaboradores */}
                {plantoesDoDia && plantoesDoDia.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1 w-full">
                    {plantoesDoDia.slice(0, 2).map((p, j) => (
                      <div
                        key={j}
                        className="text-[10px] leading-tight text-center px-1 py-0.5 rounded truncate"
                        style={{
                          backgroundColor: `${p.cor}20`,
                          color: p.cor,
                        }}
                        title={`${p.nome} — ${p.horario}`}
                      >
                        <span className="font-medium">{p.nome}</span>
                        <span className="opacity-90"> {p.horario}</span>
                      </div>
                    ))}
                    {plantoesDoDia.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setDiaDetalhe(dia)}
                        className="text-[9px] font-medium text-[#1a3c34] text-center bg-[#e8e2d4] rounded px-1 py-0.5 hover:bg-[#d4cdc0] transition"
                      >
                        +{plantoesDoDia.length - 2}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        aberto={diaDetalhe !== null}
        onFechar={() => setDiaDetalhe(null)}
        titulo={diaDetalhe !== null ? `Escala do dia ${diaDetalhe}` : ""}
        size="sm"
        overlayClassName="flex items-center justify-center bg-black/40"
        dialogClassName="mx-4"
      >
        {diaDetalhe !== null && (() => {
          const diaOriginal = diaDetalhe;
          const nomesDias = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
          const nomeDia = nomesDias[obterDiaDaAbreviado(diaOriginal, mes, ano)];
          const plantoesDoDiaDetalhe = diasMap.get(diaOriginal) ?? [];
          return (
            <>
              <div className="flex items-baseline gap-2 px-5 pt-5 pb-3 border-b border-[#e8e2d4]">
                <span className="text-3xl font-semibold text-[#1a3c34] leading-none">{diaOriginal}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#555]">{nomeDia}</span>
                  <span className="text-xs text-[#8b7d6b]">{MESES[mes - 1]} de {ano}</span>
                </div>
                <span className="ml-auto text-xs text-[#8b7d6b]">
                  {plantoesDoDiaDetalhe.length} escalado{plantoesDoDiaDetalhe.length > 1 ? "s" : ""}
                </span>
              </div>
              <ul className="flex flex-col gap-2 px-5 py-4">
                {plantoesDoDiaDetalhe.map((p, j) => (
                  <li
                    key={j}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{ backgroundColor: `${p.cor}18` }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#333]">{p.nome}</span>
                      <span className="block truncate text-xs text-[#8b7d6b]">
                        {p.cargo} • {p.horario}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}
