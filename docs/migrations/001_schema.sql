-- =============================================================================
-- Migration 001: Schema Multi-ILPI — Integra Escala
-- Data: 2026-07-07
-- Descrição: Cria schema completo multi-ILPI com RLS para o sistema Integra Escala
-- =============================================================================

-- Limpeza prévia (idempotente)
-- Ordem importa: primeiro trigger/tabelas (que carregam policies), depois funções auxiliares
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TABLE IF EXISTS public.escala_dias CASCADE;
DROP TABLE IF EXISTS public.escala_meses CASCADE;
DROP TABLE IF EXISTS public.colaboradores CASCADE;
DROP TABLE IF EXISTS public.cargos CASCADE;
DROP TABLE IF EXISTS public.usuario_ilpi CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.ilpis CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_invite_user(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_user_ilpis(UUID);
DROP FUNCTION IF EXISTS public.user_has_ilpi_access(UUID, UUID);
DROP FUNCTION IF EXISTS public.user_ilpi_role(UUID, UUID);

-- =============================================================================
-- 1. TABELA: ilpis
-- =============================================================================
CREATE TABLE public.ilpis (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    cnpj        TEXT,
    logo_url    TEXT,
    cor_primaria TEXT DEFAULT '#1a3c34',
    created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.ilpis IS 'Instituições de Longa Permanência — tenant principal do sistema multi-ILPI';

-- =============================================================================
-- 2. TABELA: cargos
-- =============================================================================
CREATE TABLE public.cargos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ilpi_id     UUID NOT NULL REFERENCES public.ilpis(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    regime      TEXT NOT NULL,
    descricao   TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cargos_ilpi_id ON public.cargos(ilpi_id);

COMMENT ON TABLE public.cargos IS 'Cargos com regimes de trabalho por ILPI';

-- =============================================================================
-- 3. TABELA: colaboradores
-- =============================================================================
CREATE TABLE public.colaboradores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ilpi_id         UUID NOT NULL REFERENCES public.ilpis(id) ON DELETE CASCADE,
    cargo_id        UUID REFERENCES public.cargos(id) ON DELETE SET NULL,
    nome            TEXT NOT NULL,
    regime          TEXT,
    horario_inicio  TIME,
    horario_fim     TIME,
    dias_folga      TEXT[],
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_colaboradores_ilpi_id ON public.colaboradores(ilpi_id);
CREATE INDEX idx_colaboradores_cargo_id ON public.colaboradores(cargo_id);

COMMENT ON TABLE public.colaboradores IS 'Colaboradores de cada ILPI — regime pode sobrescrever o do cargo';

-- =============================================================================
-- 4. TABELA: escala_meses
-- =============================================================================
CREATE TABLE public.escala_meses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ilpi_id     UUID NOT NULL REFERENCES public.ilpis(id) ON DELETE CASCADE,
    mes         INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano         INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicada')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(ilpi_id, mes, ano)
);

CREATE INDEX idx_escala_meses_ilpi_id ON public.escala_meses(ilpi_id);

COMMENT ON TABLE public.escala_meses IS 'Meses de escala — cada ILPI pode ter uma escala por mês/ano';

-- =============================================================================
-- 5. TABELA: escala_dias
-- =============================================================================
CREATE TABLE public.escala_dias (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escala_mes_id   UUID NOT NULL REFERENCES public.escala_meses(id) ON DELETE CASCADE,
    colaborador_id  UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
    dia             INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 31),
    horario_inicio  TIME,
    horario_fim     TIME,
    observacao      TEXT,
    UNIQUE(escala_mes_id, colaborador_id, dia)
);

CREATE INDEX idx_escala_dias_escala_mes_id ON public.escala_dias(escala_mes_id);
CREATE INDEX idx_escala_dias_colaborador_id ON public.escala_dias(colaborador_id);

COMMENT ON TABLE public.escala_dias IS 'Dias individuais da escala — registro de quem trabalha em cada dia do mês';

-- =============================================================================
-- 6. TABELA: usuarios
-- =============================================================================
CREATE TABLE public.usuarios (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.usuarios IS 'Perfil de usuário estendido — referência para auth.users';

-- =============================================================================
-- 7. TABELA: usuario_ilpi
-- =============================================================================
CREATE TABLE public.usuario_ilpi (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    ilpi_id     UUID NOT NULL REFERENCES public.ilpis(id) ON DELETE CASCADE,
    papel       TEXT NOT NULL CHECK (papel IN ('consulta', 'edicao', 'admin')),
    UNIQUE(usuario_id, ilpi_id)
);

CREATE INDEX idx_usuario_ilpi_usuario_id ON public.usuario_ilpi(usuario_id);
CREATE INDEX idx_usuario_ilpi_ilpi_id ON public.usuario_ilpi(ilpi_id);

COMMENT ON TABLE public.usuario_ilpi IS 'Relação N:N usuário↔ILPI com papel (consulta, edicao, admin)';

-- =============================================================================
-- 8. FUNÇÕES AUXILIARES
-- =============================================================================

-- Função: retorna o papel do usuário em uma ILPI (NULL se sem acesso)
CREATE OR REPLACE FUNCTION public.user_ilpi_role(
    p_user_id UUID,
    p_ilpi_id UUID
) RETURNS TEXT
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT papel FROM public.usuario_ilpi
    WHERE usuario_id = p_user_id AND ilpi_id = p_ilpi_id;
$$;

COMMENT ON FUNCTION public.user_ilpi_role IS 'Retorna o papel de um usuário em uma ILPI (NULL = sem acesso)';

-- Função: verifica se o usuário tem acesso de consulta a uma ILPI
CREATE OR REPLACE FUNCTION public.user_has_ilpi_access(
    p_user_id UUID,
    p_ilpi_id UUID
) RETURNS BOOLEAN
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.usuario_ilpi
        WHERE usuario_id = p_user_id AND ilpi_id = p_ilpi_id
    );
$$;

COMMENT ON FUNCTION public.user_has_ilpi_access IS 'TRUE se o usuário tem qualquer papel na ILPI';

-- Função: retorna todas as ILPIs de um usuário
CREATE OR REPLACE FUNCTION public.get_user_ilpis(
    p_user_id UUID
) RETURNS TABLE(ilpi_id UUID, ilpi_nome TEXT, ilpi_slug TEXT, papel TEXT)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT ui.ilpi_id, i.nome, i.slug, ui.papel
    FROM public.usuario_ilpi ui
    JOIN public.ilpis i ON i.id = ui.ilpi_id
    WHERE ui.usuario_id = p_user_id
    ORDER BY i.nome;
$$;

COMMENT ON FUNCTION public.get_user_ilpis IS 'Lista todas as ILPIs acessíveis por um usuário com seus papéis';

-- Função: handle_invite_user
CREATE OR REPLACE FUNCTION public.handle_invite_user(
    p_ilpi_id UUID,
    p_email TEXT,
    p_papel TEXT
) RETURNS JSON
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
    v_papel_check TEXT;
BEGIN
    -- Validação do papel
    IF p_papel NOT IN ('consulta', 'edicao', 'admin') THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'papel_invalido',
            'mensagem', 'Papel deve ser: consulta, edicao ou admin'
        );
    END IF;

    -- Verifica se a ILPI existe
    IF NOT EXISTS (SELECT 1 FROM public.ilpis WHERE id = p_ilpi_id) THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'ilpi_nao_encontrada',
            'mensagem', 'ILPI não encontrada'
        );
    END IF;

    -- Busca o usuário pelo email no auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;

    IF v_user_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'usuario_nao_encontrado',
            'mensagem', 'Usuário não encontrado. O usuário deve se cadastrar primeiro.'
        );
    END IF;

    -- Cria ou atualiza o registro em usuario_ilpi
    INSERT INTO public.usuario_ilpi (usuario_id, ilpi_id, papel)
    VALUES (v_user_id, p_ilpi_id, p_papel)
    ON CONFLICT (usuario_id, ilpi_id) DO UPDATE
    SET papel = EXCLUDED.papel;

    RETURN json_build_object(
        'sucesso', true,
        'usuario_id', v_user_id,
        'papel', p_papel,
        'mensagem', 'Vínculo criado/atualizado com sucesso'
    );
END;
$$;

COMMENT ON FUNCTION public.handle_invite_user IS 'Convida usuário para ILPI — vincula ou atualiza papel. Requer que o usuário já exista no Supabase Auth.';

-- Função: auto-cria perfil de usuário no primeiro login (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.usuarios (id, nome)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS 'Trigger: cria perfil em public.usuarios quando novo usuário faz signup no Auth';

-- Trigger: insere na tabela de perfil automaticamente
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Habilita RLS em todas as tabelas
ALTER TABLE public.ilpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_meses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_dias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_ilpi ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: ilpis
-- ---------------------------------------------------------------------------
-- SELECT: só ILPIs onde o usuário tem qualquer papel
CREATE POLICY ilpis_select ON public.ilpis
    FOR SELECT USING (
        public.user_has_ilpi_access(auth.uid(), id)
    );

-- INSERT/UPDATE/DELETE: só admin pode alterar dados da ILPI
CREATE POLICY ilpis_insert ON public.ilpis
    FOR INSERT WITH CHECK (true);

CREATE POLICY ilpis_update ON public.ilpis
    FOR UPDATE USING (
        public.user_ilpi_role(auth.uid(), id) = 'admin'
    );

CREATE POLICY ilpis_delete ON public.ilpis
    FOR DELETE USING (
        public.user_ilpi_role(auth.uid(), id) = 'admin'
    );

-- ---------------------------------------------------------------------------
-- RLS: cargos
-- ---------------------------------------------------------------------------
-- SELECT: consulta/edicao/admin
CREATE POLICY cargos_select ON public.cargos
    FOR SELECT USING (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('consulta', 'edicao', 'admin')
    );

-- INSERT/UPDATE/DELETE: edicao/admin
CREATE POLICY cargos_insert ON public.cargos
    FOR INSERT WITH CHECK (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('edicao', 'admin')
    );

CREATE POLICY cargos_update ON public.cargos
    FOR UPDATE USING (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('edicao', 'admin')
    ) WITH CHECK (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('edicao', 'admin')
    );

CREATE POLICY cargos_delete ON public.cargos
    FOR DELETE USING (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('edicao', 'admin')
    );

-- ---------------------------------------------------------------------------
-- RLS: colaboradores
-- ---------------------------------------------------------------------------
CREATE POLICY colaboradores_select ON public.colaboradores
    FOR SELECT USING (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('consulta', 'edicao', 'admin')
    );

CREATE POLICY colaboradores_insert ON public.colaboradores
    FOR INSERT WITH CHECK (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('edicao', 'admin')
    );

CREATE POLICY colaboradores_update ON public.colaboradores
    FOR UPDATE USING (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('edicao', 'admin')
    ) WITH CHECK (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('edicao', 'admin')
    );

CREATE POLICY colaboradores_delete ON public.colaboradores
    FOR DELETE USING (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('edicao', 'admin')
    );

-- ---------------------------------------------------------------------------
-- RLS: escala_meses
-- ---------------------------------------------------------------------------
CREATE POLICY escala_meses_select ON public.escala_meses
    FOR SELECT USING (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('consulta', 'edicao', 'admin')
    );

CREATE POLICY escala_meses_insert ON public.escala_meses
    FOR INSERT WITH CHECK (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('edicao', 'admin')
    );

CREATE POLICY escala_meses_update ON public.escala_meses
    FOR UPDATE USING (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('edicao', 'admin')
    ) WITH CHECK (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('edicao', 'admin')
    );

CREATE POLICY escala_meses_delete ON public.escala_meses
    FOR DELETE USING (
        public.user_ilpi_role(auth.uid(), ilpi_id) IN ('edicao', 'admin')
    );

-- ---------------------------------------------------------------------------
-- RLS: escala_dias
-- JOIN com escala_meses para obter ilpi_id
-- ---------------------------------------------------------------------------
CREATE POLICY escala_dias_select ON public.escala_dias
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.escala_meses em
            WHERE em.id = escala_mes_id
              AND public.user_ilpi_role(auth.uid(), em.ilpi_id) IN ('consulta', 'edicao', 'admin')
        )
    );

CREATE POLICY escala_dias_insert ON public.escala_dias
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.escala_meses em
            WHERE em.id = escala_mes_id
              AND public.user_ilpi_role(auth.uid(), em.ilpi_id) IN ('edicao', 'admin')
        )
    );

CREATE POLICY escala_dias_update ON public.escala_dias
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.escala_meses em
            WHERE em.id = escala_mes_id
              AND public.user_ilpi_role(auth.uid(), em.ilpi_id) IN ('edicao', 'admin')
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.escala_meses em
            WHERE em.id = escala_mes_id
              AND public.user_ilpi_role(auth.uid(), em.ilpi_id) IN ('edicao', 'admin')
        )
    );

CREATE POLICY escala_dias_delete ON public.escala_dias
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.escala_meses em
            WHERE em.id = escala_mes_id
              AND public.user_ilpi_role(auth.uid(), em.ilpi_id) IN ('edicao', 'admin')
        )
    );

-- ---------------------------------------------------------------------------
-- RLS: usuarios (perfil próprio + quem tem vínculo)
-- ---------------------------------------------------------------------------
-- SELECT: usuário vê seu próprio perfil
CREATE POLICY usuarios_select ON public.usuarios
    FOR SELECT USING (
        auth.uid() = id
    );

-- Usuários só podem atualizar seu próprio perfil (nome)
CREATE POLICY usuarios_update ON public.usuarios
    FOR UPDATE USING (
        auth.uid() = id
    ) WITH CHECK (
        auth.uid() = id
    );

-- ---------------------------------------------------------------------------
-- RLS: usuario_ilpi
-- ---------------------------------------------------------------------------
-- SELECT: usuário vê seus próprios vínculos; admin da ILPI vê todos
CREATE POLICY usuario_ilpi_select ON public.usuario_ilpi
    FOR SELECT USING (
        usuario_id = auth.uid()
        OR public.user_ilpi_role(auth.uid(), ilpi_id) = 'admin'
    );

-- INSERT: só admin da ILPI pode convidar
CREATE POLICY usuario_ilpi_insert ON public.usuario_ilpi
    FOR INSERT WITH CHECK (
        public.user_ilpi_role(auth.uid(), ilpi_id) = 'admin'
    );

-- UPDATE: só admin da ILPI pode alterar papéis
CREATE POLICY usuario_ilpi_update ON public.usuario_ilpi
    FOR UPDATE USING (
        public.user_ilpi_role(auth.uid(), ilpi_id) = 'admin'
    ) WITH CHECK (
        public.user_ilpi_role(auth.uid(), ilpi_id) = 'admin'
    );

-- DELETE: admin da ILPI ou o próprio usuário pode remover vínculo
CREATE POLICY usuario_ilpi_delete ON public.usuario_ilpi
    FOR DELETE USING (
        usuario_id = auth.uid()
        OR public.user_ilpi_role(auth.uid(), ilpi_id) = 'admin'
    );

-- =============================================================================
-- FIM DA MIGRATION 001
-- =============================================================================
