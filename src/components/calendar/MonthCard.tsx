"use client";

import { useMemo } from "react";
import { Pencil, Sparkles, X } from "lucide-react";

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
  compacto?: boolean;
}

// Mock data para demonstração - colaboradores fixos
const COLABORADORES_FIXOS = [
  { nome: "Fátima Silva", cor: "#1a3c34" },
  { nome: "Maria Souza", cor: "#c4b998" },
  { nome: "João Costa", cor: "#8b5e3c" },
  { nome: "Carlos Pereira", cor: "#5a7a6a" },
  { nome: "Ana Oliveira", cor: "#a0522d" },
  { nome: "José Santos", cor: "#6b8e7a" },
  { nome: "Rita Lima", cor: "#8b7355" },
  { nome: "Lúcia Mendes", cor: "#556b5a" },
];

function gerarMockDiasComNomes(mes: number, ano: number): DiaEscala[] {
  const totalDias = new Date(ano, mes, 0).getDate();
  const dias: DiaEscala[] = [];
  const horarios = ["24h", "07h-19h", "19h-07h", "07h-17h", "13h-21h"];

  for (let d = 1; d <= totalDias; d++) {
    if (Math.random() > 0.25) {
      const qtd = 1 + Math.floor(Math.random() * 3);
      const selecionados = COLABORADORES_FIXOS
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(qtd, COLABORADORES_FIXOS.length));
      
      dias.push({
        dia: d,
        plantoes: selecionados.map((c) => ({
          nome: c.nome.split(" ")[0], // Primeiro nome apenas no compacto
          cargo: "",
          horario: horarios[Math.floor(Math.random() * horarios.length)],
          cor: c.cor,
        })),
      });
    }
  }
  return dias;
}

function getDiaSemana(dia: number, mes: number, ano: number) {
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
  compacto = false,
}: MonthCardProps) {
  const dias = diasProp ?? gerarMockDiasComNomes(mes, ano);
  const totalDias = getTotalDias(mes, ano);
  const primeiroDiaSemana = getDiaSemana(1, mes, ano);

  const diasMap = useMemo(() => {
    const map = new Map<number, Plantao[]>();
    dias.forEach((d) => map.set(d.dia, d.plantoes));
    return map;
  }, [dias]);

  // Contar colaboradores únicos neste mês
  const colaboradoresNoMes = useMemo(() => {
    const nomes = new Set<string>();
    dias.forEach((d) => d.plantoes.forEach((p) => nomes.add(p.nome)));
    return nomes.size;
  }, [dias]);

  // Gera as células do calendário
  const celulas = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < primeiroDiaSemana; i++) cells.push(null);
    for (let d = 1; d <= totalDias; d++) cells.push(d);
    return cells;
  }, [totalDias, primeiroDiaSemana]);

  return (
    <div
      className={`bg-white rounded-xl border border-[#e8e2d4] overflow-hidden transition-shadow hover:shadow-sm ${
        compacto ? "" : ""
      }`}
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

      {/* Lista de colaboradores (mostra nomes) */}
      <div className="px-5 py-3 border-b border-[#e8e2d4] bg-[#faf8f4]">
        <div className="flex flex-wrap gap-4">
          {COLABORADORES_FIXOS.slice(0, 6).map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: c.cor }}
              />
              <span className="text-[#555]">{c.nome}</span>
            </div>
          ))}
          {COLABORADORES_FIXOS.length > 6 && (
            <span className="text-sm text-[#8b7d6b]">
              +{COLABORADORES_FIXOS.length - 6} mais
            </span>
          )}
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

        {/* Células */}
        <div className="grid grid-cols-7 gap-1">
          {celulas.map((dia, i) => {
            if (dia === null) return <div key={`empty-${i}`} className="aspect-square" />;

            const plantoesDoDia = diasMap.get(dia);
            const diaSemana = getDiaSemana(dia, mes, ano);
            const isFimDeSemana = diaSemana === 0 || diaSemana === 6;

            return (
              <div
                key={dia}
                className={`relative rounded p-1 min-h-[48px] flex flex-col items-center ${
                  isFimDeSemana ? "bg-[#faf8f4]" : ""
                }`}
              >
                <span
                  className={`text-xs leading-tight font-medium ${
                    diaSemana === 0 ? "text-red-400" : "text-[#555]"
                  }`}
                >
                  {dia}
                </span>
                {/* Nomes e horários dos colaboradores */}
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
                      <span className="text-[9px] text-[#8b7d6b] text-center">
                        +{plantoesDoDia.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}