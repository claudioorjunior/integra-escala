"use client";

import { User, Mail, Phone, Briefcase, Clock, Calendar, X, Pencil, FileText } from "lucide-react";

interface Colaborador {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  regime: string;
  foto_url: string | null;
  ativo: boolean;
  created_at: string;
}

interface ColaboradorModalProps {
  colaborador: Colaborador | null;
  aberto: boolean;
  onFechar: () => void;
}

export default function ColaboradorModal({
  colaborador,
  aberto,
  onFechar,
}: ColaboradorModalProps) {
  if (!aberto || !colaborador) return null;

  const iniciais = colaborador.nome
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header com gradiente */}
        <div className="relative bg-gradient-to-br from-[#1a3c34] to-[#2a5c4a] px-6 py-10">
          <button
            onClick={onFechar}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition p-1.5 hover:bg-white/10 rounded-lg"
          >
            <X size={20} strokeWidth={2} />
          </button>

          <div className="flex flex-col items-center">
            {/* Foto/Avatar */}
            <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center mb-4 border-4 border-white/30 shadow-lg">
              {colaborador.foto_url ? (
                <img
                  src={colaborador.foto_url}
                  alt={colaborador.nome}
                  className="w-28 h-28 rounded-full object-cover"
                />
              ) : (
                <span className="text-5xl font-light text-white">
                  {iniciais}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-medium text-white text-center mb-1">
              {colaborador.nome}
            </h2>
            <p className="text-base text-white/80 text-center">
              {colaborador.cargo}
            </p>

            {/* Status badge */}
            <span
              className={`mt-3 inline-flex items-center px-4 py-1.5 rounded-full text-xs font-medium ${
                colaborador.ativo
                  ? "bg-green-500/20 text-green-100 border border-green-400/30"
                  : "bg-red-500/20 text-red-100 border border-red-400/30"
              }`}
            >
              {colaborador.ativo ? "● Ativo" : "● Inativo"}
            </span>
          </div>
        </div>

        {/* Dados em cards */}
        <div className="px-6 py-6 space-y-4">
          {/* Info grid */}
          <div className="grid grid-cols-1 gap-3">
            {/* Email */}
            <div className="flex items-center gap-4 p-4 bg-[#faf8f4] rounded-xl border border-[#e8e2d4] hover:border-[#1a3c34]/30 transition">
              <div className="w-11 h-11 rounded-xl bg-[#1a3c34]/10 flex items-center justify-center shrink-0">
                <Mail size={18} strokeWidth={2} className="text-[#1a3c34]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#8b7d6b] uppercase tracking-wider font-medium">Email</p>
                <p className="text-sm text-[#333] font-medium mt-0.5 truncate">
                  {colaborador.email}
                </p>
              </div>
            </div>

            {/* Telefone */}
            <div className="flex items-center gap-4 p-4 bg-[#faf8f4] rounded-xl border border-[#e8e2d4] hover:border-[#1a3c34]/30 transition">
              <div className="w-11 h-11 rounded-xl bg-[#1a3c34]/10 flex items-center justify-center shrink-0">
                <Phone size={18} strokeWidth={2} className="text-[#1a3c34]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#8b7d6b] uppercase tracking-wider font-medium">Telefone</p>
                <p className="text-sm text-[#333] font-medium mt-0.5">
                  {colaborador.telefone}
                </p>
              </div>
            </div>

            {/* Regime */}
            <div className="flex items-center gap-4 p-4 bg-[#faf8f4] rounded-xl border border-[#e8e2d4] hover:border-[#1a3c34]/30 transition">
              <div className="w-11 h-11 rounded-xl bg-[#1a3c34]/10 flex items-center justify-center shrink-0">
                <Clock size={18} strokeWidth={2} className="text-[#1a3c34]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#8b7d6b] uppercase tracking-wider font-medium">Regime de Trabalho</p>
                <p className="text-sm text-[#333] font-medium mt-0.5">
                  {colaborador.regime}
                </p>
              </div>
            </div>

            {/* Data de cadastro */}
            <div className="flex items-center gap-4 p-4 bg-[#faf8f4] rounded-xl border border-[#e8e2d4] hover:border-[#1a3c34]/30 transition">
              <div className="w-11 h-11 rounded-xl bg-[#1a3c34]/10 flex items-center justify-center shrink-0">
                <Calendar size={18} strokeWidth={2} className="text-[#1a3c34]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#8b7d6b] uppercase tracking-wider font-medium">Data de Cadastro</p>
                <p className="text-sm text-[#333] font-medium mt-0.5">
                  {new Date(colaborador.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Info adicional */}
          <div className="pt-4 border-t border-[#e8e2d4]">
            <div className="flex items-center gap-2 text-sm text-[#8b7d6b]">
              <Briefcase size={14} strokeWidth={2} />
              <span>ID: {colaborador.id}</span>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="px-6 py-5 bg-[#faf8f4] border-t border-[#e8e2d4] flex gap-3">
          <button className="flex-1 bg-[#1a3c34] text-white text-sm font-medium rounded-xl px-5 py-3 hover:bg-[#143028] transition flex items-center justify-center gap-2 shadow-sm">
            <Pencil size={15} strokeWidth={2} />
            Editar
          </button>
          <button className="flex-1 border-2 border-[#d4cdc0] text-[#555] text-sm font-medium rounded-xl px-5 py-3 hover:border-[#1a3c34] hover:text-[#1a3c34] transition flex items-center justify-center gap-2">
            <FileText size={15} strokeWidth={2} />
            Ver Escalas
          </button>
        </div>
      </div>
    </div>
  );
}
