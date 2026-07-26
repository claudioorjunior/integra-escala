"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLocalUser } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { Plus, Search, Filter } from "lucide-react";
import ColaboradorModal from "@/components/colaboradores/ColaboradorModal";

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

export default function ColaboradoresPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<Colaborador | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroCargo, setFiltroCargo] = useState<string>("todos");

  useEffect(() => {
    async function carregarDados() {
      const user = await getLocalUser();
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const db = await getDB();
        // 1. Pegar a ILPI vinculada
        const uiRes = await db.query<{ ilpi_id: string }>(
          `SELECT ilpi_id FROM public.usuario_ilpi WHERE usuario_id = $1 LIMIT 1;`,
          [user.id]
        );

        if (uiRes.rows.length === 0) {
          setLoading(false);
          return;
        }

        const ilpiId = uiRes.rows[0].ilpi_id;

        // 2. Pegar colaboradores
        const colabsRes = await db.query<any>(
          `SELECT 
            c.id, 
            c.nome, 
            c.email, 
            c.telefone, 
            c.regime, 
            c.ativo, 
            c.created_at,
            cg.nome as cargo
           FROM public.colaboradores c
           LEFT JOIN public.cargos cg ON cg.id = c.cargo_id
           WHERE c.ilpi_id = $1
           ORDER BY c.nome;`,
          [ilpiId]
        );

        const mapped: Colaborador[] = colabsRes.rows.map((row: any) => ({
          id: row.id,
          nome: row.nome,
          email: row.email || "",
          telefone: row.telefone || "",
          cargo: row.cargo || "Sem cargo",
          regime: row.regime || "Não definido",
          foto_url: null,
          ativo: row.ativo ?? true,
          created_at: row.created_at,
        }));

        setColaboradores(mapped);
      } catch (err) {
        console.error("Erro ao carregar colaboradores do banco local:", err);
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
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

      {/* Modal de detalhes */}
      <ColaboradorModal
        colaborador={colaboradorSelecionado}
        aberto={modalAberto}
        onFechar={fecharModal}
      />
    </>
  );
}
