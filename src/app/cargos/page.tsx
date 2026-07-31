"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getLocalUser, signOut } from "@/lib/auth";
import { getDB, criarCargo, atualizarCargo, excluirCargo } from "@/lib/db";
import { Briefcase, Plus } from "lucide-react";
import { ptBR } from "@/lib/i18n/pt-BR";
import CargoModal from "@/components/cargos/CargoModal";
import AppShell from "@/components/layout/AppShell";

interface Cargo {
  id: string;
  nome: string;
  regime: string;
  descricao: string | null;
}

export default function CargosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [cargoEditando, setCargoEditando] = useState<Cargo | null>(null);

  const carregarCargos = useCallback(async () => {
    const user = await getLocalUser();
    if (!user) {
      await signOut();
      router.push("/login");
      return;
    }

    try {
      const db = await getDB();
      const uiRes = await db.query<{ ilpi_id: string }>(
        `SELECT ilpi_id FROM public.usuario_ilpi WHERE usuario_id = $1 LIMIT 1;`,
        [user.id]
      );
      if (uiRes.rows.length === 0) return;
      const ilpiId = uiRes.rows[0].ilpi_id;

      const res = await db.query<any>(
        `SELECT id, nome, regime, descricao FROM public.cargos 
         WHERE ilpi_id = $1 ORDER BY nome;`,
        [ilpiId]
      );

      setCargos(
        res.rows.map((row: any) => ({
          id: row.id,
          nome: row.nome,
          regime: row.regime,
          descricao: row.descricao,
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar cargos:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    carregarCargos();
  }, [carregarCargos]);

  function abrirCriar() {
    setCargoEditando(null);
    setModalAberto(true);
  }

  function abrirEditar(cargo: Cargo) {
    setCargoEditando(cargo);
    setModalAberto(true);
  }

  async function handleSalvar(dados: { nome: string; regime: string; descricao?: string }) {
    const user = await getLocalUser();
    if (!user) return;

    if (cargoEditando) {
      await atualizarCargo(user.id, cargoEditando.id, dados);
    } else {
      await criarCargo(user.id, dados);
    }

    await carregarCargos();
  }

  async function handleExcluir() {
    const user = await getLocalUser();
    if (!user || !cargoEditando) return;
    await excluirCargo(user.id, cargoEditando.id);
    await carregarCargos();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#1a3c34] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-[#1a3c34]">Cargos</h1>
          <p className="text-sm text-[#8b7d6b] mt-0.5">
            Gerencie os cargos e regimes de trabalho da equipe
          </p>
        </div>
        <button
          onClick={abrirCriar}
          className="bg-[#1a3c34] text-white text-sm font-medium rounded-lg px-5 py-2.5 hover:bg-[#143028] transition flex items-center gap-2"
        >
          <Plus size={16} strokeWidth={2} />
          Novo Cargo
        </button>
      </div>

      {cargos.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e8e2d4] px-5 py-12 text-center text-[#8b7d6b]">
          <p className="text-sm mb-2">{ptBR.emptyStates.cargos.noRolesFound}</p>
          <p className="text-xs text-[#8b7d6b]/70">
            Clique em &quot;Novo Cargo&quot; para cadastrar o primeiro cargo da instituição.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cargos.map((cargo) => (
            <div
              key={cargo.id}
              onClick={() => abrirEditar(cargo)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirEditar(cargo); } }}
              role="button"
              tabIndex={0}
              className="bg-white rounded-xl border border-[#e8e2d4] p-5 hover:shadow-sm transition-shadow flex items-start gap-4 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#1a3c34]/10 flex items-center justify-center shrink-0">
                <Briefcase size={18} strokeWidth={2} className="text-[#1a3c34]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-medium text-[#1a3c34] truncate">
                  {cargo.nome}
                </h3>
                <p className="text-xs text-[#8b7d6b] mt-0.5 font-medium uppercase tracking-wider">
                  Regime: {cargo.regime}
                </p>
                {cargo.descricao && (
                  <p className="text-sm text-[#555] mt-2 line-clamp-2">
                    {cargo.descricao}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CargoModal
        cargo={cargoEditando}
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onSalvar={handleSalvar}
        onExcluir={cargoEditando ? handleExcluir : undefined}
      />
      </AppShell>
  );
}
