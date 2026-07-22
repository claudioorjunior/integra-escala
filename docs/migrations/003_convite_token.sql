-- =============================================================================
-- Migration 003: Convite via token + LGPD
-- Data: 2026-07-07
-- Descrição: Substitui o fluxo inseguro de convite por token assinado,
--   com aceite explícito, expiração e auditoria completa.
--   Resolve os achados 1, 2 e 10 do relatório de segurança.
-- =============================================================================

-- =============================================================================
-- 1. Tabela de convites (token, expiração, aceite)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.convites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ilpi_id UUID NOT NULL REFERENCES public.ilpis(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    papel TEXT NOT NULL CHECK (papel IN ('consulta', 'edicao', 'admin')),
    token_hash TEXT NOT NULL UNIQUE,           -- armazena SHA256 do token, não o token puro
    convidado_por UUID NOT NULL,                -- admin que criou o convite
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_em TIMESTAMPTZ NOT NULL,
    aceito_em TIMESTAMPTZ,                      -- NULL = pendente
    aceito_por UUID,                            -- usuário que aceitou (id em auth.users)
    revogado_em TIMESTAMPTZ,                    -- NULL = não revogado
    revogado_por UUID,
    ip_origem INET,
    user_agent TEXT,
    base_legal TEXT DEFAULT 'execucao_de_contrato',  -- LGPD: base legal do tratamento
    finalidade TEXT DEFAULT 'gestao_acesso_plataforma'
);

CREATE INDEX idx_convites_token_hash ON public.convites(token_hash);
CREATE INDEX idx_convites_ilpi ON public.convites(ilpi_id, criado_em DESC);
CREATE INDEX idx_convites_email ON public.convites(lower(email));

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

-- Admin da ILPI vê os convites da sua ILPI
DROP POLICY IF EXISTS convites_select ON public.convites;
CREATE POLICY convites_select ON public.convites
    FOR SELECT
    TO authenticated
    USING (public.user_ilpi_role(auth.uid(), ilpi_id) = 'admin');

-- service_role insere (backend) e atualiza (quando aceito)
DROP POLICY IF EXISTS convites_insert ON public.convites;
CREATE POLICY convites_insert ON public.convites
    FOR INSERT
    TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS convites_update ON public.convites;
CREATE POLICY convites_update ON public.convites
    FOR UPDATE
    TO service_role
    USING (true);

COMMENT ON TABLE public.convites IS 'Convites por token. Apenas admins veem; apenas service_role manipula. Token puro nunca é armazenado — só o hash SHA256.';

-- =============================================================================
-- 2. Atualiza handle_invite_user para usar a tabela de convites
-- =============================================================================
DROP FUNCTION IF EXISTS public.handle_invite_user(UUID, TEXT, TEXT);

-- A função agora retorna o TOKEN em texto puro (gerado aqui) que o admin envia ao usuário.
-- Esse token só é retornado uma vez — não tem como recuperar depois.
-- O resto do fluxo é gerenciado pela função aceitar_convite abaixo.
CREATE OR REPLACE FUNCTION public.handle_invite_user(
    p_ilpi_id UUID,
    p_email TEXT,
    p_papel TEXT
) RETURNS JSON
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = public, pg_temp
    AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_token_raw TEXT;
    v_token_hash TEXT;
    v_convite_id UUID;
    v_expira_em TIMESTAMPTZ;
BEGIN
    -- 1. Validação de autenticação
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'nao_autenticado',
            'mensagem', 'Você precisa estar autenticado.'
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

    -- 3. Verifica ILPI
    IF NOT EXISTS (SELECT 1 FROM public.ilpis WHERE id = p_ilpi_id) THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'ilpi_nao_encontrada',
            'mensagem', 'ILPI não encontrada'
        );
    END IF;

    -- 4. Verifica permissão do chamador (admin)
    v_caller_role := public.user_ilpi_role(v_caller_id, p_ilpi_id);
    IF v_caller_role IS NULL OR v_caller_role <> 'admin' THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'sem_permissao',
            'mensagem', 'Apenas administradores podem convidar usuários.'
        );
    END IF;

    -- 5. Gera token seguro (32 bytes = 256 bits de entropia)
    v_token_raw := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_token_raw, 'sha256'), 'hex');

    -- 6. Convite expira em 7 dias
    v_expira_em := now() + INTERVAL '7 days';

    -- 7. Insere convite
    INSERT INTO public.convites (
        ilpi_id, email, papel, token_hash, convidado_por, expira_em
    ) VALUES (
        p_ilpi_id, lower(trim(p_email)), p_papel, v_token_hash, v_caller_id, v_expira_em
    )
    RETURNING id INTO v_convite_id;

    -- 8. Auditoria (sem expor email puro)
    INSERT INTO public.audit_log (ilpi_id, actor_id, acao, detalhes)
    VALUES (
        p_ilpi_id, v_caller_id, 'convite_criado',
        jsonb_build_object(
            'convite_id', v_convite_id,
            'email_hash', encode(digest(lower(trim(p_email)), 'sha256'), 'hex'),
            'papel', p_papel
        )
    );

    -- 9. Retorna o token puro (única vez que aparece)
    RETURN json_build_object(
        'sucesso', true,
        'convite_id', v_convite_id,
        'token', v_token_raw,
        'expira_em', v_expira_em,
        'mensagem', 'Convite criado. Envie o link ao usuário. O token não será exibido novamente.'
    );
END;
$$;

COMMENT ON FUNCTION public.handle_invite_user IS 'Cria convite por token. Apenas admins. Retorna token puro uma única vez. service_role apenas.';

REVOKE EXECUTE ON FUNCTION public.handle_invite_user(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_invite_user(UUID, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_invite_user(UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_invite_user(UUID, TEXT, TEXT) TO service_role;

-- =============================================================================
-- 3. Função para aceitar o convite (pode ser chamada por authenticated)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.aceitar_convite(
    p_token TEXT,
    p_ip_origem INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS JSON
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = public, pg_temp
    AS $$
DECLARE
    v_user_id UUID;
    v_token_hash TEXT;
    v_convite RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'nao_autenticado',
            'mensagem', 'Faça login antes de aceitar o convite.'
        );
    END IF;

    IF p_token IS NULL OR length(p_token) < 16 THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'token_invalido',
            'mensagem', 'Token inválido.'
        );
    END IF;

    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    SELECT * INTO v_convite FROM public.convites
    WHERE token_hash = v_token_hash
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'token_nao_encontrado',
            'mensagem', 'Convite não encontrado ou já utilizado.'
        );
    END IF;

    IF v_convite.aceito_em IS NOT NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'convite_ja_aceito',
            'mensagem', 'Este convite já foi aceito.'
        );
    END IF;

    IF v_convite.revogado_em IS NOT NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'convite_revogado',
            'mensagem', 'Este convite foi revogado.'
        );
    END IF;

    IF v_convite.expira_em < now() THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'convite_expirado',
            'mensagem', 'Este convite expirou.'
        );
    END IF;

    -- Verifica se o email do usuário logado bate com o email do convite
    IF NOT EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = v_user_id AND email = v_convite.email
    ) THEN
        RETURN json_build_object(
            'sucesso', false,
            'erro', 'email_nao_confere',
            'mensagem', 'O email da sua conta não corresponde ao convite.'
        );
    END IF;

    -- Cria ou atualiza o vínculo
    INSERT INTO public.usuario_ilpi (usuario_id, ilpi_id, papel)
    VALUES (v_user_id, v_convite.ilpi_id, v_convite.papel)
    ON CONFLICT (usuario_id, ilpi_id) DO UPDATE
    SET papel = EXCLUDED.papel;

    -- Marca o convite como aceito
    UPDATE public.convites
    SET aceito_em = now(),
        aceito_por = v_user_id,
        ip_origem = p_ip_origem,
        user_agent = p_user_agent
    WHERE id = v_convite.id;

    -- Auditoria
    INSERT INTO public.audit_log (ilpi_id, actor_id, acao, detalhes)
    VALUES (
        v_convite.ilpi_id, v_user_id, 'convite_aceito',
        jsonb_build_object(
            'convite_id', v_convite.id,
            'papel', v_convite.papel
        )
    );

    RETURN json_build_object(
        'sucesso', true,
        'ilpi_id', v_convite.ilpi_id,
        'papel', v_convite.papel,
        'mensagem', 'Convite aceito com sucesso.'
    );
END;
$$;

COMMENT ON FUNCTION public.aceitar_convite IS 'Aceita convite por token. Disponível para authenticated. Valida email, expiração e revogação.';

REVOKE EXECUTE ON FUNCTION public.aceitar_convite(TEXT, INET, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aceitar_convite(TEXT, INET, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.aceitar_convite(TEXT, INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceitar_convite(TEXT, INET, TEXT) TO service_role;

-- =============================================================================
-- 4. Função para revogar convite
-- =============================================================================
CREATE OR REPLACE FUNCTION public.revogar_convite(p_convite_id UUID)
RETURNS JSON
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = public, pg_temp
    AS $$
DECLARE
    v_user_id UUID;
    v_role TEXT;
    v_ilpi_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('sucesso', false, 'erro', 'nao_autenticado');
    END IF;

    SELECT ilpi_id INTO v_ilpi_id FROM public.convites WHERE id = p_convite_id;
    IF v_ilpi_id IS NULL THEN
        RETURN json_build_object('sucesso', false, 'erro', 'convite_nao_encontrado');
    END IF;

    v_role := public.user_ilpi_role(v_user_id, v_ilpi_id);
    IF v_role IS NULL OR v_role <> 'admin' THEN
        RETURN json_build_object('sucesso', false, 'erro', 'sem_permissao');
    END IF;

    UPDATE public.convites
    SET revogado_em = now(),
        revogado_por = v_user_id
    WHERE id = p_convite_id AND revogado_em IS NULL AND aceito_em IS NULL;

    INSERT INTO public.audit_log (ilpi_id, actor_id, acao, detalhes)
    VALUES (v_ilpi_id, v_user_id, 'convite_revogado',
            jsonb_build_object('convite_id', p_convite_id));

    RETURN json_build_object('sucesso', true, 'mensagem', 'Convite revogado.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revogar_convite(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revogar_convite(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.revogar_convite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revogar_convite(UUID) TO service_role;

-- =============================================================================
-- 5. Função de bootstrap: cria ILPI com primeiro admin (apenas service_role)
-- =============================================================================
-- Para o caso de Integra Senior criar a primeira ILPI e o primeiro admin.
-- Roda via service_role apenas. SEM validação de auth.uid() porque é chamada
-- apenas em contexto de backend confiável (script de provisionamento).
CREATE OR REPLACE FUNCTION public.bootstrap_ilpi(
    p_nome TEXT,
    p_slug TEXT,
    p_cnpj TEXT,
    p_admin_user_id UUID,
    p_papel TEXT DEFAULT 'admin'
) RETURNS JSON
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
    v_ilpi_id UUID;
BEGIN
    IF p_papel NOT IN ('consulta', 'edicao', 'admin') THEN
        RETURN json_build_object('sucesso', false, 'erro', 'papel_invalido');
    END IF;

    INSERT INTO public.ilpis (nome, slug, cnpj)
    VALUES (p_nome, p_slug, p_cnpj)
    RETURNING id INTO v_ilpi_id;

    INSERT INTO public.usuario_ilpi (usuario_id, ilpi_id, papel)
    VALUES (p_admin_user_id, v_ilpi_id, p_papel);

    INSERT INTO public.audit_log (ilpi_id, actor_id, acao, detalhes)
    VALUES (v_ilpi_id, p_admin_user_id, 'ilpi_criada_bootstrap',
            jsonb_build_object('slug', p_slug, 'papel_admin', p_papel));

    RETURN json_build_object(
        'sucesso', true,
        'ilpi_id', v_ilpi_id,
        'mensagem', 'ILPI criada com admin vinculado.'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_ilpi(TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bootstrap_ilpi(TEXT, TEXT, TEXT, UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_ilpi(TEXT, TEXT, TEXT, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_ilpi(TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.bootstrap_ilpi IS 'Cria ILPI com primeiro admin. Apenas service_role (uso da equipe Integra Senior).';

-- =============================================================================
-- 6. View de convites ativos (para o admin ver sem expor hash do token)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_convites_ativos AS
SELECT
    c.id,
    c.ilpi_id,
    c.email,
    c.papel,
    c.criado_em,
    c.expira_em,
    c.aceito_em,
    c.revogado_em,
    CASE
        WHEN c.aceito_em IS NOT NULL THEN 'aceito'
        WHEN c.revogado_em IS NOT NULL THEN 'revogado'
        WHEN c.expira_em < now() THEN 'expirado'
        ELSE 'pendente'
    END AS status
FROM public.convites c;

COMMENT ON VIEW public.v_convites_ativos IS 'Convites com status calculado — para a tela do admin. Não expõe hash do token.';

GRANT SELECT ON public.v_convites_ativos TO authenticated;
GRANT SELECT ON public.v_convites_ativos TO service_role;

-- =============================================================================
-- Fim da migration 003
-- =============================================================================