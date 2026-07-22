"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { Plus, Search, Filter } from "lucide-react";
import ColaboradorModal from "@/components/colaboradores/ColaboradorModal";
import { ptBR } from "@/lib/i18n/pt-BR";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

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

// Mock data para demonstração
const MOCK_COLABORADORES: Colaborador[] = [
  {
    id: "1",
    nome: "Fátima Silva",
    email: "fatima@integra.com",
    telefone: "(21) 99999-1111",
    cargo: "Cuidadora",
    regime: "24/72",
    foto_url: null,
    ativo: true,
    created_at: "2026-01-15",
  },
  {
    id: "2",
    nome: "Maria Souza",
    email: "maria@integra.com",
    telefone: "(21) 99999-2222",
    cargo: "Técnica de Enfermagem",
    regime: "5x2 (8h)",
    foto_url: null,
    ativo: true,
    created_at: "2026-02-01",
  },
  {
    id: "3",
    nome: "João Costa",
    email: "joao@integra.com",
    telefone: "(21) 99999-3333",
    cargo: "Noturnista",
    regime: "12x36",
    foto_url: null,
    ativo: true,
    created_at: "2026-02-15",
  },
  {
    id: "4",
    nome: "Carlos Pereira",
    email: "carlos@integra.com",
    telefone: "(21) 99999-4444",
    cargo: "Cuidador",
    regime: "24/72",
    foto_url: null,
    ativo: true,
    created_at: "2026-03-01",
  },
  {
    id: "5",
    nome: "Ana Oliveira",
    email: "ana@integra.com",
    telefone: "(21) 99999-5555",
    cargo: "Noturnista",
    regime: "12x36",
    foto_url: null,
    ativo: true,
    created_at: "2026-03-10",
  },
  {
    id: "6",
    nome: "José Santos",
    email: "jose@integra.com",
    telefone: "(21) 99999-6666",
    cargo: "Diarista",
    regime: "5x2 (8h)",
    foto_url: null,
    ativo: true,
    created_at: "2026-03-20",
  },
  {
    id: "7",
    nome: "Rita Lima",
    email: "rita@integra.com",
    telefone: "(21) 99999-7777",
    cargo: "Técnica de Enfermagem",
    regime: "5x2 (8h)",
    foto_url: null,
    ativo: true,
    created_at: "2026-04-01",
  },
  {
    id: "8",
    nome: "Lúcia Mendes",
    email: "lucia@integra.com",
    telefone: "(21) 99999-8888",
    cargo: "Técnica de Enfermagem",
    regime: "5x2 (8h)",
    foto_url: null,
    ativo: false,
    created_at: "2026-04-15",
  },
];

export default function ColaboradoresPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>(MOCK_COLABORADORES);
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<Colaborador | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroCargo, setFiltroCargo] = useState<string>("todos");

  useEffect(() => {
    const supabase = getClient();
    if (!supabase) {
      router.push("/login");
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#1a3c34] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cargos = ["todos", ...new Set(colaboradores.map((c) => c.cargo))];

  const colaboradoresFiltrados = colaboradores.filter((c) => {
    const matchBusca = c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      c.email.toLowerCase().includes(busca.toLowerCase());
    const matchCargo = filtroCargo === "todos" || c.cargo === filtroCargo;
    return matchBusca && matchCargo;
  });

  function abrirModal(colaborador: Colaborador) {
    setColaboradorSelecionado(colaborador);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setColaboradorSelecionado(null);
  }

  return (
    <>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-[#1a3c34]">Colaboradores</h1>
          <p className="text-sm text-[#8b7d6b] mt-0.5">
            Gerencie sua equipe de colaboradores
          </p>
        </div>
        <button className="bg-[#1a3c34] text-white text-sm font-medium rounded-lg px-5 py-2.5 hover:bg-[#143028] transition flex items-center gap-2">
          <Plus size={16} strokeWidth={2} />
          Novo Colaborador
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-[#e8e2d4] px-5 py-4 mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b7d6b]" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#d4cdc0] rounded-lg text-sm focus:outline-none focus:border-[#1a3c34] transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} strokeWidth={2} className="text-[#8b7d6b]" />
          <select
            value={filtroCargo}
            onChange={(e) => setFiltroCargo(e.target.value)}
            className="px-4 py-2.5 border border-[#d4cdc0] rounded-lg text-sm focus:outline-none focus:border-[#1a3c34] transition bg-white"
          >
            {cargos.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo === "todos" ? "Todos os cargos" : cargo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de colaboradores */}
      {colaboradoresFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e8e2d4] px-5 py-8 text-center text-[#8b7d6b]">
          {ptBR.emptyStates.colaboradores.noTeamMembersFound}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {colaboradoresFiltrados.map((colaborador) => (
            <div
              key={colaborador.id}
              onClick={() => abrirModal(colaborador)}
              className="bg-white rounded-xl border border-[#e8e2d4] p-5 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Foto */}
                <div className="w-16 h-16 rounded-full bg-[#1a3c34]/10 flex items-center justify-center shrink-0">
                  {colaborador.foto_url ? (
                    <img
                      src={colaborador.foto_url}
                      alt={colaborador.nome}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-medium text-[#1a3c34]">
                      {colaborador.nome.charAt(0)}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-medium text-[#1a3c34] truncate">
                    {colaborador.nome}
                  </h3>
                  <p className="text-sm text-[#8b7d6b] mt-0.5">
                    {colaborador.cargo}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        colaborador.ativo
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {colaborador.ativo ? "Ativo" : "Inativo"}
                    </span>
                    <span className="text-xs text-[#8b7d6b]">
                      {colaborador.regime}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalhes */}
      <ColaboradorModal
        colaborador={colaboradorSelecionado}
        aberto={modalAberto}
        onFechar={fecharModal}
      />
    </>
  );
}
