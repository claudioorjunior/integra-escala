"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLocalUser, signOut } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { Settings, Home, User, Database } from "lucide-react";

export default function ConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<{ nome: string; email: string; ilpi: string } | null>(null);

  useEffect(() => {
    async function carregarConfig() {
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
        let ilpiNome = "Nenhuma ILPI vinculada";

        if (uiRes.rows.length > 0) {
          const ilpiRes = await db.query<{ nome: string }>(
            `SELECT nome FROM public.ilpis WHERE id = $1;`,
            [uiRes.rows[0].ilpi_id]
          );
          ilpiNome = ilpiRes.rows[0]?.nome || ilpiNome;
        }

        setUserInfo({
          nome: user.nome,
          email: user.email,
          ilpi: ilpiNome,
        });
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      } finally {
        setLoading(false);
      }
    }

    carregarConfig();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#1a3c34] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-medium text-[#1a3c34]">Configurações</h1>
        <p className="text-sm text-[#8b7d6b] mt-0.5">
          Visualize as configurações da sua conta e da instituição
        </p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Perfil */}
        <div className="bg-white rounded-xl border border-[#e8e2d4] p-6">
          <div className="flex items-center gap-3 mb-4">
            <User size={18} className="text-[#1a3c34]" />
            <h2 className="text-base font-semibold text-[#1a3c34]">Dados do Usuário</h2>
          </div>
          <div className="space-y-3 text-sm text-[#555]">
            <div>
              <span className="text-[#8b7d6b] block">Nome</span>
              <span className="font-medium text-[#333]">{userInfo?.nome}</span>
            </div>
            <div>
              <span className="text-[#8b7d6b] block">E-mail</span>
              <span className="font-medium text-[#333]">{userInfo?.email}</span>
            </div>
          </div>
        </div>

        {/* Instituição */}
        <div className="bg-white rounded-xl border border-[#e8e2d4] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Home size={18} className="text-[#1a3c34]" />
            <h2 className="text-base font-semibold text-[#1a3c34]">Minha Instituição (ILPI)</h2>
          </div>
          <div className="space-y-3 text-sm text-[#555]">
            <div>
              <span className="text-[#8b7d6b] block">Razão Social / Nome</span>
              <span className="font-medium text-[#333]">{userInfo?.ilpi}</span>
            </div>
          </div>
        </div>

        {/* Armazenamento local */}
        <div className="bg-white rounded-xl border border-[#e8e2d4] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database size={18} className="text-[#1a3c34]" />
            <h2 className="text-base font-semibold text-[#1a3c34]">Armazenamento Local</h2>
          </div>
          <p className="text-sm text-[#555] leading-relaxed">
            O Integra Escala armazena os dados localmente na sua máquina de forma offline
            usando o banco de dados IndexedDB de alto desempenho (PGlite). Seus dados não são enviados a servidores externos.
          </p>
        </div>
      </div>
    </>
  );
}
