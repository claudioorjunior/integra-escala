"use client";

import { useState, useEffect } from "react";
import { X, Save, Trash2 } from "lucide-react";

const REGIMES = ["24/72", "12x36", "5x2", "8h/dia"];

interface Cargo {
  id: string;
  nome: string;
  regime: string;
  descricao: string | null;
}

interface CargoModalProps {
  cargo: Cargo | null; // null = criando novo
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (dados: { nome: string; regime: string; descricao?: string }) => Promise<void>;
  onExcluir?: () => Promise<void>;
}

export default function CargoModal({
  cargo,
  aberto,
  onFechar,
  onSalvar,
  onExcluir,
}: CargoModalProps) {
  const [nome, setNome] = useState("");
  const [regime, setRegime] = useState(REGIMES[0]);
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const editando = cargo !== null;

  useEffect(() => {
    if (aberto) {
      setNome(cargo?.nome ?? "");
      setRegime(cargo?.regime ?? REGIMES[0]);
      setDescricao(cargo?.descricao ?? "");
      setErro(null);
    }
  }, [aberto, cargo]);

  if (!aberto) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("O nome do cargo é obrigatório.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      await onSalvar({ nome: nome.trim(), regime, descricao: descricao.trim() || undefined });
      onFechar();
    } catch (err: any) {
      setErro(err?.message || "Erro ao salvar cargo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExcluir() {
    if (!onExcluir || !cargo) return;
    if (!confirm(`Excluir o cargo "${cargo.nome}"? Colaboradores vinculados ficarão sem cargo.`)) return;
    setLoading(true);
    setErro(null);
    try {
      await onExcluir();
      onFechar();
    } catch (err: any) {
      setErro(err?.message || "Erro ao excluir cargo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1a3c34] to-[#2a5c4a] px-6 py-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">
              {editando ? "Editar Cargo" : "Novo Cargo"}
            </h2>
            <button onClick={onFechar} className="text-white/70 hover:text-white p-1">
              <X size={20} strokeWidth={2} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {erro}
            </div>
          )}

          <div>
            <label htmlFor="cargo-nome" className="block text-sm font-medium text-[#555] mb-1.5">
              Nome do cargo *
            </label>
            <input
              id="cargo-nome"
              type="text"
              required
              placeholder="Ex: Cuidador, Técnico de Enfermagem..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full border border-[#d4cdc0] rounded-lg px-4 py-2.5 text-sm outline-none transition focus:border-[#1a3c34] focus:ring-2 focus:ring-[#1a3c34]/10"
            />
          </div>

          <div>
            <label htmlFor="cargo-regime" className="block text-sm font-medium text-[#555] mb-1.5">
              Regime de trabalho *
            </label>
            <select
              id="cargo-regime"
              value={regime}
              onChange={(e) => setRegime(e.target.value)}
              className="w-full border border-[#d4cdc0] rounded-lg px-4 py-2.5 text-sm outline-none transition focus:border-[#1a3c34] focus:ring-2 focus:ring-[#1a3c34]/10 bg-white"
            >
              {REGIMES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cargo-descricao" className="block text-sm font-medium text-[#555] mb-1.5">
              Descrição <span className="text-[#8b7d6b] font-normal">(opcional)</span>
            </label>
            <textarea
              id="cargo-descricao"
              rows={3}
              placeholder="Responsabilidades, observações..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full border border-[#d4cdc0] rounded-lg px-4 py-2.5 text-sm outline-none transition focus:border-[#1a3c34] focus:ring-2 focus:ring-[#1a3c34]/10 resize-none"
            />
          </div>

          {/* Ações */}
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
    </div>
  );
}
