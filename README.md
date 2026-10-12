# Soloplan Campo

Sistema da Soloplan (consultoria agrícola, Quirinópolis-GO): visão do escritório e visão do cliente.

## Etapa 1: banco, perfis e permissões (aprovada)

As regras de acesso ficam dentro do banco (row level security do Supabase), não só na tela.

| Perfil | Lê | Escreve |
|---|---|---|
| Admin | tudo, inclusive a auditoria | tudo; aprova e envia laudos; apaga; gerencia usuários |
| Funcionário | tudo | cadastra e edita; não aprova laudo, não apaga, não gerencia usuários |
| IA | tudo | só rascunhos (ocorrência, aplicação, custo, laudos); nunca muda status |
| Cliente | só os próprios dados aprovados; laudos só depois de enviados | pedidos de laudo parcial e envio de laudo de solo, só para si |
| Sem login / sem vínculo | nada | nada |

Garantias feitas pelo banco:
- Cada registro carrega o cliente dono, copiado do registro pai. Não dá para forjar nem mover entre clientes.
- Tudo o que a IA cria nasce `rascunho_ia`. Só admin passa para `aprovado` ou `enviado_ao_cliente`.
- Quem aprovou, quando aprovou e quando enviou são gravados pelo banco.
- Toda criação, edição e exclusão vai para a tabela `auditoria`, com o antes e o depois.

Arquivos:
- `supabase/migrations/`: o banco (vai para o Supabase como está).
- `supabase/tests/`: 13 testes de permissão e isolamento. Rodar: `npm run test:db` (precisa de um Postgres local).

Pendente para as próximas etapas: regras de acesso dos arquivos (fotos e PDFs) no armazenamento do Supabase, junto com o upload na etapa 3.

## Etapa 2: cadastro de clientes, fazendas, talhões e safras (concluída, aguardando aprovação)

Telas (Next.js, em `web/`): entrar, painel, clientes, cliente, fazenda (com talhões e dados do CAR), safra (com régua de estádios), e os formulários de cada um.
Regras compartilhadas com o futuro app de celular em `packages/regras/` (números no formato brasileiro, CPF/CNPJ inclusive alfanumérico, ano agrícola, estádios).

Decisões confirmadas com a Soloplan: lançamentos da equipe aparecem para o cliente na hora; só admin apaga; fazenda não muda de cliente.

### Rodar localmente
1. Postgres 16 rodando em 127.0.0.1:5432 (usuário postgres/postgres).
2. `npm install`
3. `npm run reset:supabase` e depois `npm run dev:supabase` (login e API do Supabase sem Docker; imprime as chaves locais).
4. Copie a ANON_KEY para `web/.env.local` como `NEXT_PUBLIC_SUPABASE_ANON_KEY`, com `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`.
5. `npm -w @soloplan/web run dev` e abra http://127.0.0.1:3000

### Testes
- `npm test`: regras (15) e permissões do banco (13).
- `node tests/e2e/etapa2.mjs qa`: passeio completo no navegador (precisa do site e do Supabase local rodando, e dos usuários de demonstração).
