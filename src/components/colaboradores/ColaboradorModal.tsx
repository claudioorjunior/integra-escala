"use client";

import { useState, useEffect } from "react";
import { Save, Trash2 } from "lucide-react";
import { REGIMES_PRESETS, normalizarRegime } from "@/lib/scheduling";
import Modal from "@/components/ui/Modal";

const REGIMES = [...REGIMES_PRESETS];

export interface CargoOpcao {
  id: string;
  nome: string;
}

export interface ColaboradorForm {
  id: string;
  nome: string;
  cargo: string; // nome do cargo (legacy display)
  regime: string;
  ativo: boolean;
}

interface ColaboradorModalProps {
  colaborador: ColaboradorForm | null; // null = criando novo
  cargos: CargoOpcao[];
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (dados: {
    nome: string;
    cargoId: string | null;
    regime: string;
    ativo: boolean;
  }) => Promise<void>;
  onExcluir?: () => Promise<void>;
}

export default function ColaboradorModal({
  colaborador,
  cargos,
  aberto,
  onFechar,
  onSalvar,
  onExcluir,
}: ColaboradorModalProps) {
  const [nome, setNome] = useState("");
  const [cargoId, setCargoId] = useState<string>("");
  const [regime, setRegime] = useState<string>(REGIMES[0]);
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const editando = colaborador !== null;

  useEffect(() => {
    if (aberto) {
      setNome(colaborador?.nome ?? "");
      setRegime(colaborador?.regime ?? REGIMES[0]);
      setAtivo(colaborador?.ativo ?? true);
      setCargoId("");
      setErro(null);
    }
  }, [aberto, colaborador]);

  if (!aberto) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("O nome do colaborador é obrigatório.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      await onSalvar({
        nome: nome.trim(),
        cargoId: cargoId || null,
        regime,
        ativo,
      });
      onFechar();
    } catch (err: any) {
      setErro(err?.message || "Erro ao salvar colaborador.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExcluir() {
    if (!onExcluir || !colaborador) return;
    if (!confirm(`Excluir o colaborador "${colaborador.nome}"?`)) return;
    setLoading(true);
    setErro(null);
    try {
      await onExcluir();
      onFechar();
    } catch (err: any) {
      setErro(err?.message || "Erro ao excluir colaborador.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={editando ? "Editar Colaborador" : "Novo Colaborador"}
      size="md"
    >
      <div className="relative">
        <div className="bg-gradient-to-br from-[#1a3c34] to-[#2a5c4a] px-6 py-6">
          <h2
            id={`modal-title-${editando ? "editar-colaborador" : "novo-colaborador"}`}
            className="text-lg font-medium text-white"
          >
            {editando ? "Editar Colaborador" : "Novo Colaborador"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {erro}
            </div>
          )}

          <div>
            <label htmlFor="colab-nome" className="block text-sm font-medium text-[#555] mb-1.5">
              Nome *
            </label>
            <input
              id="colab-nome"
              type="text"
              required
              placeholder="Ex: Fátima Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full border border-[#d4cdc0] rounded-lg px-4 py-2.5 text-sm outline-none transition focus:border-[#1a3c34] focus:ring-2 focus:ring-[#1a3c34]/10"
            />
          </div>

          <div>
            <label htmlFor="colab-cargo" className="block text-sm font-medium text-[#555] mb-1.5">
              Cargo
            </label>
            <select
              id="colab-cargo"
              value={cargoId}
              onChange={(e) => setCargoId(e.target.value)}
              className="w-full border border-[#d4cdc0] rounded-lg px-4 py-2.5 text-sm outline-none transition focus:border-[#1a3c34] focus:ring-2 focus:ring-[#1a3c34]/10 bg-white"
            >
              <option value="">Sem cargo</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="colab-regime" className="block text-sm font-medium text-[#555] mb-1.5">
              Regime de trabalho *
            </label>
            <input
              id="colab-regime"
              type="text"
              list="regime-presets-colab"
              required
              placeholder="Ex: 12x36, 24/72, 12x72, 5x2..."
              value={regime}
              onChange={(e) => setRegime(e.target.value)}
              className="w-full border border-[#d4cdc0] rounded-lg px-4 py-2.5 text-sm outline-none transition focus:border-[#1a3c34] focus:ring-2 focus:ring-[#1a3c34]/10"
            />
            <datalist id="regime-presets-colab">
              {REGIMES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            {regime && !normalizarRegime(regime) && (
              <p className="text-xs text-amber-600 mt-1">
                Formato não reconhecido. Use o padrão NxM (ex: 12x36, 12x72) ou um regime nomeado (24/72, 5x2, noturnista, diarista).
              </p>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="w-4 h-4 rounded border-[#d4cdc0] text-[#1a3c34] focus:ring-[#1a3c34]/20"
            />
            <span className="text-sm text-[#555]">Colaborador ativo</span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            {editando && onExcluir && (
              <button
                type="button"
                onClick={handleExcluir}
                disabled={loading}
                className="text-sm text-red-600 hover:text-red-700 transition px-3 py-2 flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 size={14} strokeWidth={2} />
                Excluir
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onFechar}
              disabled={loading}
              className="text-sm text-[#8b7d6b] hover:text-[#555] transition px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#1a3c34] text-white text-sm font-medium rounded-lg px-5 py-2 hover:bg-[#143028] transition flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={14} strokeWidth={2} />
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
