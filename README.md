# Soloplan Campo

Sistema da Soloplan (consultoria agrícola, Quirinópolis-GO): visão do escritório e visão do cliente.

## Etapa 1: banco, perfis e permissões (concluída, aguardando aprovação)

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
