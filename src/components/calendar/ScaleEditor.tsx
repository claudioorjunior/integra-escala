"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { X, Sparkles, Printer, Trash2, Save, ChevronDown, Search } from "lucide-react";
import { getLocalUser } from "@/lib/auth";
import { getDB, buscarEscalaDoMes, salvarEscalaDoMes, excluirEscalaDoMes, PlantaoDB } from "@/lib/db";
import { gerarEscala, type Colaborador as ColaboradorEscala, normalizarRegime, horarioPeloRegime, type Aviso } from "@/lib/scheduling";
import Modal from "@/components/ui/Modal";

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
  gerarAoAbrir?: boolean;
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

function diaDaAbreviadoFn(dia: number, mes: number, ano: number) {
  return new Date(ano, mes - 1, dia).getDay();
}


function mapColaboradorParaEscala(c: Colaborador): ColaboradorEscala {
  return {
    id: c.id,
    nome: c.nome,
    cargoId: null,
    cargoNome: c.cargo,
    // Passa o regime original (texto livre) — o gerador normaliza e emite aviso se não reconhecer
    regime: c.regime,
  };
}

export default function ScaleEditor({
  mes,
  ano,
  aberto,
  onFechar,
  onSalvo,
  gerarAoAbrir = false,
}: ScaleEditorProps) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [plantoes, setPlantoes] = useState<Record<number, Record<string, string>>>({});
  const [status, setStatus] = useState<"rascunho" | "publicada">("rascunho");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const geracaoAutomaticaRef = useRef(false);
  const [menuDia, setMenuDia] = useState<number | null>(null);
  const [buscaColab, setBuscaColab] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const totalDias = getTotalDias(mes, ano);
  const firstWeekday = diaDaAbreviadoFn(1, mes, ano);

  const celulas = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= totalDias; d++) cells.push(d);
    return cells;
  }, [totalDias, firstWeekday]);

  useEffect(() => {
    if (!aberto) return;

    let cancelled = false;
    geracaoAutomaticaRef.current = false;
    setColaboradores([]);
    setPlantoes({});
    setAvisos([]);
    setErro(null);

    async function carregarDados() {
      const user = await getLocalUser();
      if (!user || cancelled) return;

      setLoading(true);
      try {
        const db = await getDB();

        // 1. Carregar colaboradores reais
        const uiRes = await db.query<{ ilpi_id: string }>(
          `SELECT ilpi_id FROM public.usuario_ilpi WHERE usuario_id = $1 LIMIT 1;`,
          [user.id]
        );
        if (uiRes.rows.length === 0 || cancelled) return;
        const ilpiId = uiRes.rows[0].ilpi_id;

        const colabsRes = await db.query<any>(
          `SELECT c.id, c.nome, c.regime, cg.nome as cargo
           FROM public.colaboradores c
           LEFT JOIN public.cargos cg ON cg.id = c.cargo_id
           WHERE c.ilpi_id = $1 AND c.ativo = true
           ORDER BY c.nome;`,
          [ilpiId]
        );

        if (cancelled) return;
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
        if (cancelled) return;
        setStatus(escala.status as any || "rascunho");

        const plantoesRecord: Record<number, Record<string, string>> = {};
        for (const p of escala.plantoes) {
          if (!plantoesRecord[p.dia]) plantoesRecord[p.dia] = {};
          const inicio = (p.horarioInicio ?? "07:00").slice(0, 5);
          const fim = (p.horarioFim ?? "19:00").slice(0, 5);
          plantoesRecord[p.dia][p.colaboradorId] = `${inicio}-${fim}`;
        }
        setPlantoes(plantoesRecord);
      } catch (err) {
        console.error("Erro ao carregar escala:", err);
        if (!cancelled) setErro("Não foi possível carregar a escala. Tente novamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    carregarDados();
    return () => { cancelled = true; };
  }, [mes, ano, aberto]);

  // Algoritmo de geração automática (motor de scheduling)
  const handleGerarEscala = useCallback((confirmarSubstituicao = true) => {
    const temDados = Object.values(plantoes).some((d) => Object.keys(d).length > 0);
    if (confirmarSubstituicao && temDados && !confirm("Gerar a escala substituirá os plantões atuais deste mês. Continuar?")) return;
    setErro(null);
    setAvisos([]);

    try {
      const colabEscala: ColaboradorEscala[] = colaboradores.map(mapColaboradorParaEscala);
      const resultado = gerarEscala({
        mes,
        ano,
        colaboradores: colabEscala,
        manterAjustesManuais: false,
        seed: mes + ano * 100,
      });

      const novosPlantoes: Record<number, Record<string, string>> = {};
      for (let d = 1; d <= totalDias; d++) {
        novosPlantoes[d] = {};
        for (const p of resultado.plantoes[d] ?? []) {
          novosPlantoes[d][p.colaboradorId] = `${p.horario.inicio}-${p.horario.fim}`;
        }
      }
      setPlantoes(novosPlantoes);
      if (resultado.avisos.length > 0) {
        setAvisos(resultado.avisos);
      }
    } catch (err) {
      console.error("Erro ao gerar escala:", err);
      setErro("Erro ao gerar escala. Tente novamente.");
    }
  }, [ano, colaboradores, mes, plantoes, totalDias]);

  useEffect(() => {
    if (!aberto || !gerarAoAbrir || loading || colaboradores.length === 0 || geracaoAutomaticaRef.current) return;
    geracaoAutomaticaRef.current = true;
    handleGerarEscala(false);
  }, [aberto, colaboradores.length, gerarAoAbrir, handleGerarEscala, loading]);

  useEffect(() => {
    if (menuDia === null) return;
    const aoClicarFora = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuDia(null);
        setBuscaColab("");
      }
    };
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [menuDia]);

  const diasTotalLinhas = Math.ceil((firstWeekday + totalDias) / 7);
  const alturaLinha = `min(132px, calc((100dvh - 340px) / ${diasTotalLinhas}))`;

  // Alternar turno ao clicar na célula
  function toggleCell(dia: number, colabId: string, regime: string) {
    setPlantoes((prev) => {
      const copy = { ...prev, [dia]: { ...(prev[dia] ?? {}) } };
      const atual = copy[dia][colabId];
      if (!atual) {
        // Define horário padrão usando horarioPeloRegime do motor
        const regimeNormalizado = normalizarRegime(regime);
        const horario = regimeNormalizado
          ? horarioPeloRegime(regimeNormalizado)
          : { inicio: "08:00", fim: "17:00" };
        copy[dia][colabId] = `${horario.inicio}-${horario.fim}`;
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
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={`${MESES[mes - 1]} ${ano}`}
      size="full"
      overlayClassName="flex items-start justify-center overflow-hidden bg-black/40"
      dialogClassName="mx-4 my-4 h-[92dvh] max-h-[92dvh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e2d4] shrink-0">
        <div>
          <h2 className="text-lg font-medium text-[#1a3c34]">
            {MESES[mes - 1]} {ano}
          </h2>
          <p className="text-xs text-[#8b7d6b] mt-0.5">
            O mês inteiro fica visível. Gere a escala para distribuir os colaboradores por dia.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleGerarEscala()}
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
        </div>
      </div>

          {/* Legenda */}
          <div className="px-6 py-3 border-b border-[#e8e2d4] bg-[#faf8f4] shrink-0">
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

          {/* Grade mensal agrupada por dia */}
          <div className="overflow-auto flex-1 min-h-0">
            <div className="min-w-[860px] p-4">
              <div className="grid grid-cols-7 gap-px bg-[#e8e2d4] rounded-lg overflow-hidden">
                <div className="col-span-7 grid grid-cols-7 gap-px">
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

                {celulas.map((dia, i) => {
                if (dia === null) {
                  return <div key={`empty-${i}`} className="bg-[#f5f3ee]" style={{ minHeight: alturaLinha }} />;
                }

                const diaDaAbreviado = diaDaAbreviadoFn(dia, mes, ano);
                const fimDeAbreviado = diaDaAbreviadoFn(dia, mes, ano);
                const isWeekendDay = fimDeAbreviado === 0 || fimDeAbreviado === 6;
                const plantoesDoDia = Object.entries(plantoes[dia] ?? {})
                  .map(([colabId, horario]) => ({
                    colab: colaboradores.find((item) => item.id === colabId),
                    horario,
                  }))
                  .filter((item): item is { colab: Colaborador; horario: string } => Boolean(item.colab));
                const disponiveis = colaboradores.filter((colab) => !plantoes[dia]?.[colab.id]);

                return (
                  <div
                    key={dia}
                    className={`p-2 flex flex-col gap-1.5 ${
                      isWeekendDay ? "bg-[#faf8f4]" : "bg-white"
                    }`}
                    style={{ minHeight: alturaLinha }}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${diaDaAbreviado === 0 ? "text-red-400" : "text-[#555]"}`}>
                        {dia}
                      </span>
                      <span className="text-[10px] text-[#b0a697]">
                        {plantoesDoDia.length > 0 ? `${plantoesDoDia.length} escalado${plantoesDoDia.length > 1 ? "s" : ""}` : "Livre"}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      {plantoesDoDia.map(({ colab, horario }) => (
                        <button
                          type="button"
                          key={`${dia}-${colab.id}`}
                          onClick={() => toggleCell(dia, colab.id, colab.regime)}
                          aria-label={`${colab.nome}, dia ${dia}, ${horario}. Clique para remover`}
                          className="w-full rounded-md px-1.5 py-1 text-left text-[10px] leading-tight transition-colors hover:bg-red-50"
                          style={{
                            backgroundColor: `${colab.cor}20`,
                            color: colab.cor,
                          }}
                          title={`${colab.nome} - ${horario}. Clique para remover`}
                        >
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colab.cor }} />
                            <span className="truncate font-medium">{colab.nome}</span>
                          </span>
                          <span className="block pl-2.5 opacity-80">{horario}</span>
                        </button>
                      ))}
                    </div>

                    {disponiveis.length > 0 && (
                      <div className="relative mt-auto">
                        <button
                          type="button"
                          aria-label={`Adicionar colaborador ao dia ${dia}`}
                          onClick={() => {
                            setMenuDia((ativo) => (ativo === dia ? null : dia));
                            setBuscaColab("");
                          }}
                          className="w-full flex items-center justify-center gap-1 rounded border border-dashed border-[#d4cdc0] px-1 py-1 text-[10px] text-[#8b7d6b] outline-none hover:border-[#1a3c34] hover:text-[#1a3c34]"
                        >
                          <ChevronDown size={12} strokeWidth={2} />
                          Adicionar
                        </button>
                        {menuDia === dia && (
                          <div
                            ref={menuRef}
                            className="absolute bottom-full left-0 z-20 mb-1 w-64 rounded-lg border border-[#e8e2d4] bg-white shadow-xl"
                          >
                            <div className="flex items-center gap-1 border-b border-[#e8e2d4] px-2 py-1.5">
                              <Search size={13} strokeWidth={2} className="text-[#8b7d6b]" />
                              <input
                                autoFocus
                                value={buscaColab}
                                onChange={(e) => setBuscaColab(e.target.value)}
                                placeholder="Buscar colaborador"
                                className="w-full bg-transparent text-xs text-[#333] outline-none placeholder:text-[#b0a697]"
                              />
                            </div>
                            <ul className="max-h-60 overflow-y-auto py-1">
                              {disponiveis
                                .filter((c) => c.nome.toLowerCase().includes(buscaColab.toLowerCase()))
                                .map((colab) => {
                                  const horarioPrevisto = normalizarRegime(colab.regime)
                                    ? horarioPeloRegime(normalizarRegime(colab.regime)!)
                                    : null;
                                  return (
                                    <li key={colab.id}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          toggleCell(dia, colab.id, colab.regime);
                                          setMenuDia(null);
                                          setBuscaColab("");
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#f5f3ee]"
                                      >
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colab.cor }} />
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate text-xs font-medium text-[#333]">{colab.nome}</span>
                                          <span className="block truncate text-[10px] text-[#8b7d6b]">
                                            {colab.cargo} • {colab.regime}
                                            {horarioPrevisto ? ` • ${horarioPrevisto.inicio}-${horarioPrevisto.fim}` : ""}
                                          </span>
                                        </span>
                                      </button>
                                    </li>
                                  );
                                })}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>
          </div>

          {/* Ações finais */}
          <div className="px-6 py-4 border-t border-[#e8e2d4] bg-[#faf8f4] flex items-center justify-between shrink-0">
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
              {avisos.length > 0 && (
                <div className="flex flex-col gap-1 max-w-md">
                  {avisos.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      <span className="font-medium">{a.tipo}:</span>
                      <span className="flex-1">{a.mensagem}</span>
                      <button
                        onClick={() => setAvisos(avisos.filter((_, j) => j !== i))}
                        className="text-amber-600 hover:text-amber-800"
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
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
    </Modal>
  );
}
