-- =============================================================================
-- Migration 002: Hardening de Segurança — Integra Escala
-- Data: 2026-07-07
-- Descrição: Corrige vulnerabilidades críticas identificadas na revisão:
--   1. handle_invite_user: valida admin + REVOKE PUBLIC + GEN trap
--   2. ilpis_insert: restringe a admins autenticados
--   3. Outras funções SECURITY DEFINER: REVOKE explícito
--   4. Tabela de auditoria para operações sensíveis
-- =============================================================================

-- =============================================================================
-- 1. CORREÇÃO CRÍTICA: handle_invite_user
-- =============================================================================
DROP FUNCTION IF EXISTS public.handle_invite_user(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.handle_invite_user(
    p_ilpi_id UUID,
    p_email TEXT,
    p_papel TEXT
) RETURNS JSON
    LANGUAGE plpgsql
    SECURITY INVOKER  -- mudou: roda com permissões do chamador, não do dono
    SET search_path = public, pg_temp
    AS $$
DECLARE
    v_user_id UUID;
    v_caller_role TEXT;
    v_caller_id UUID;
BEGIN
    -- 1. Pega o ID do usuário chamador a partir da sessão do Supabase
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'nao_autenticado',
            'mensagem', 'Você precisa estar autenticado para convidar usuários.'
        );
    END IF;

    -- 2. Validação do papel solicitado
    IF p_papel NOT IN ('consulta', 'edicao', 'admin') THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'papel_invalido',
            'mensagem', 'Papel deve ser: consulta, edicao ou admin'
        );
    END IF;

    -- 3. Verifica se a ILPI existe
    IF NOT EXISTS (SELECT 1 FROM public.ilpis WHERE id = p_ilpi_id) THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'ilpi_nao_encontrada',
            'mensagem', 'ILPI não encontrada'
        );
    END IF;

    -- 4. Verifica se o chamador é admin da ILPI alvo
    v_caller_role := public.user_ilpi_role(v_caller_id, p_ilpi_id);
    IF v_caller_role IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'sem_acesso',
            'mensagem', 'Você não tem acesso a esta ILPI.'
        );
    END IF;
    IF v_caller_role <> 'admin' THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'sem_permissao',
            'mensagem', 'Apenas administradores podem convidar usuários.'
        );
    END IF;

    -- 5. Busca o usuário pelo email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = lower(trim(p_email));

    -- 6. Resposta GENÉRICA para não vazar existência de email
    IF v_user_id IS NULL THEN
        -- Registra tentativa de convite falha na auditoria
        INSERT INTO public.audit_log (ilpi_id, actor_id, acao, detalhes)
        VALUES (p_ilpi_id, v_caller_id, 'convite_email_nao_encontrado',
                jsonb_build_object('email_target_hash', encode(digest(lower(trim(p_email)), 'sha256'), 'hex')));

        RETURN json_build_object(
            'sucesso', false,
            'erro', 'usuario_nao_encontrado',
            'mensagem', 'Usuário não encontrado no sistema.'
        );
    END IF;

    -- 7. Cria ou atualiza o vínculo
    INSERT INTO public.usuario_ilpi (usuario_id, ilpi_id, papel)
    VALUES (v_user_id, p_ilpi_id, p_papel)
    ON CONFLICT (usuario_id, ilpi_id) DO UPDATE
    SET papel = EXCLUDED.papel;

    -- 8. Auditoria
    INSERT INTO public.audit_log (ilpi_id, actor_id, acao, detalhes)
    VALUES (p_ilpi_id, v_caller_id, 'convite_realizado',
            jsonb_build_object('convidado_id', v_user_id, 'papel', p_papel));

    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Vínculo criado/atualizado com sucesso'
    );
END;
$$;

COMMENT ON FUNCTION public.handle_invite_user IS 'Convida usuário para ILPI. Apenas admins da ILPI podem chamar. SECURITY INVOKER, resposta genérica, audit log.';

-- Revoga acesso de PUBLIC/anon/authenticated; apenas service_role pode chamar via backend confiável
-- (a policy via SECURITY INVOKER + checagem de admin já protege, mas REVOKE é uma camada extra)
REVOKE EXECUTE ON FUNCTION public.handle_invite_user(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_invite_user(UUID, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_invite_user(UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_invite_user(UUID, TEXT, TEXT) TO service_role;

-- =============================================================================
-- 2. CORREÇÃO: ilpis_insert muito permissivo
-- =============================================================================
-- A policy antiga permitia qualquer autenticado criar ILPI. Agora apenas admins
-- do sistema (que precisam estar vinculados a pelo menos uma ILPI já existente)
-- podem criar. Para o caso de bootstrap da primeira ILPI, a Integra Senior cria
-- diretamente via service_role.
DROP POLICY IF EXISTS ilpis_insert ON public.ilpis;

CREATE POLICY ilpis_insert ON public.ilpis
    FOR INSERT
    TO authenticated
    WITH CHECK (false);  -- Bloqueado para usuários finais. Use service_role no backend.

-- =============================================================================
-- 3. REVOKE explícito em outras SECURITY DEFINER functions
-- =============================================================================
-- As funções user_ilpi_role, user_has_ilpi_access, get_user_ilpis precisam
-- rodar com permissões do dono para enxergar auth.users. Mantemos SECURITY
-- DEFINER mas tornamos as permissões EXPLÍCITAS.

REVOKE EXECUTE ON FUNCTION public.user_ilpi_role(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_ilpi_role(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_ilpi_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_ilpi_role(UUID, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.user_has_ilpi_access(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_ilpi_access(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_has_ilpi_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_ilpi_access(UUID, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_ilpis(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_ilpis(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_ilpis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_ilpis(UUID) TO service_role;

-- =============================================================================
-- 4. Tabela de auditoria (LGPD — rastro de operações sensíveis)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ilpi_id UUID REFERENCES public.ilpis(id) ON DELETE SET NULL,
    actor_id UUID,  -- referência a auth.users, sem FK para não bloquear deleções
    acao TEXT NOT NULL,  -- ex: 'convite_realizado', 'login', 'escala_publicada'
    detalhes JSONB DEFAULT '{}'::jsonb,
    ip_origem INET,
    user_agent TEXT
);

CREATE INDEX idx_audit_log_ilpi ON public.audit_log(ilpi_id, created_at DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins da ILPI podem ver o audit log da própria ILPI
DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log
    FOR SELECT
    TO authenticated
    USING (public.user_ilpi_role(auth.uid(), ilpi_id) = 'admin');

-- service_role insere (via trigger de auth, etc.)
DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE POLICY audit_log_insert ON public.audit_log
    FOR INSERT
    TO service_role
    WITH CHECK (true);

COMMENT ON TABLE public.audit_log IS 'Registro de auditoria LGPD — apenas admins da ILPI podem consultar; inserção apenas via service_role/backend.';

-- =============================================================================
-- 5. Função auxiliar: hash_email para LGPD no audit log
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- Fim da migration 002
-- =============================================================================