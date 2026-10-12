# Checklist de produção · Soloplan Campo

Estado em 12/10/2026. **Feito** = existe e foi testado. **Parcial** = existe, mas com limite descrito. **Falta** = depende de conta ou decisão do dono.

| # | Item | Estado | Onde / o que falta |
|---|---|---|---|
| 1 | Camadas e segredos | Feito | Regras de negócio em `packages/regras` (sem tela), telas em `web`. A chave de serviço só existe em `web/src/lib/supabase/admin.ts` (servidor); o navegador só recebe a URL e a chave pública. Cabeçalhos de segurança em `web/next.config.ts`. **Falta:** Content-Security-Policy (precisa de "nonce"). |
| 2 | Dados e RLS | Feito | RLS em todas as tabelas, depósitos privados, 27 testes de banco + testes de arquivos, incluindo testes que falham de propósito quando a regra é aberta. |
| 3 | Autenticação e permissão | Feito | Papéis admin / funcionário / cliente / IA no banco; telas protegidas no servidor; nada da IA chega ao cliente sem aprovação de admin. |
| 4 | Versionamento | Parcial | Git com histórico por etapa e ramo `soloplan-campo`. CI em `.github/workflows/ci.yml` (**não executado ainda**). **Falta:** proteger a linha principal (exigir CI verde), e rollback = voltar a versão anterior na hospedagem + migração reversa escrita à mão (não há migrações de volta). |
| 5 | Integrações | Parcial | API da IA (OpenAPI), Storage, programa do Ollama. **Falta:** e-mail/WhatsApp para avisar o produtor, se for desejado. |
| 6 | Deploy | Falta | Precisa das contas do dono: Supabase (produção) e Vercel, domínio, variáveis de ambiente. Roteiro na etapa 9. |
| 7 | Segurança e abuso | Parcial | Chave da IA só como hash e revogável; limite de requisições por IP nas rotas da IA (`web/src/lib/ia/http.ts`); erros sem detalhes internos. **Falta:** limite compartilhado entre servidores (hoje fica na memória de cada um); limite no login (o Supabase tem o dele; conferir configuração em produção). |
| 8 | Cache | Falta (de propósito) | Telas são dinâmicas e por usuário; cache só quando houver lentidão medida. Preços do dia e listas fixas são candidatos. |
| 9 | Escala | N/A por ora | Hospedagem sem servidor escala sozinha. Balanceador só se houver necessidade real. |
| 10 | Observabilidade | Parcial | Erros em JSON no log (`web/src/lib/log.ts`), tela de erro amigável, teste de saúde em `/api/saude`. **Falta:** rastreio de erros (Sentry ou similar) e alerta quando cair; precisa de conta. |

Antes de abrir ao público: itens 6, 7 (limite compartilhado e CSP) e 10.
