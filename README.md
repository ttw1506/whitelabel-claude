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

## Etapa 2: cadastro de clientes, fazendas, talhões e safras (aprovada)

Telas (Next.js, em `web/`): entrar, painel, clientes, cliente, fazenda (com talhões e dados do CAR), safra (com régua de estádios), e os formulários de cada um.
Regras compartilhadas com o futuro app de celular em `packages/regras/` (números no formato brasileiro, CPF/CNPJ inclusive alfanumérico, ano agrícola, estádios).

Decisões confirmadas com a Soloplan: lançamentos da equipe aparecem para o cliente na hora; só admin apaga; fazenda não muda de cliente.

### Rodar localmente
1. Postgres 16 rodando em 127.0.0.1:5432 (usuário postgres/postgres).
2. Node.js 22.12+ e `npm ci`
3. `npm run reset:supabase` e depois `npm run dev:supabase` (login e API do Supabase sem Docker; imprime as chaves locais).
4. Copie a ANON_KEY para `web/.env.local` como `NEXT_PUBLIC_SUPABASE_ANON_KEY`, com `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`.
5. `npm -w @soloplan/web run dev` e abra http://127.0.0.1:3000

### Testes
- `npm test`: regras (15) e permissões do banco (13).
- `node tests/e2e/etapa2.mjs qa`: passeio completo no navegador (precisa do site e do Supabase local rodando, e dos usuários de demonstração).

## Etapa 3: tela da safra (concluída)

- Linha do tempo por estádio com as fotos. A foto é comprimida no navegador (lado maior 1920 px); o original fica guardado. Data, hora e GPS vêm do EXIF da foto.
- Fotos num depósito privado (`fotos`): o produtor só abre fotos liberadas das próprias safras; só a equipe envia; só admin apaga.
- Ocorrências, aplicações (o custo da aplicação vira lançamento de custo automaticamente) e custos por categoria, com total e R$/ha.
- Rascunhos da IA ficam fora do total e só o admin aprova.
- Laudos da safra: a equipe escreve, só o admin aprova e envia ao cliente.

Testes: `npm test` (regras e banco), `npm run test:integracao` (isolamento das fotos, com o Supabase local rodando),
`node tests/e2e/etapa2.mjs qa` e `node tests/e2e/etapa3.mjs qa` (passeio no navegador, com site e Supabase local rodando).
O Supabase local agora inclui o serviço de arquivos (supabase/storage compilado em /home/user/tools/storage-api).

## Etapa 4: visão do cliente (concluída)

- **Meus gastos** (`/cliente/gastos`): total investido, R$/ha, safra por safra e por categoria, com filtro por safra, fazenda e categoria. Só custos aprovados do próprio produtor (regra do banco).
- **Minhas safras** (`/cliente/safras`): fotos por estádio, ocorrências, aplicações, custos e laudos já enviados; botão **Pedir laudo parcial**.
- **Usuários** (`/usuarios`, só admin): convite por link (a pessoa cria a própria senha em `/convite`), papel, produtor vinculado, ativar/desativar.
  O servidor precisa de `SUPABASE_SERVICE_ROLE_KEY` (só no servidor, nunca no navegador) para criar convites.
- **Painel**: pendências (pedidos dos produtores, laudos para revisar/enviar, rascunhos para aprovar) e fotos novas da semana.

Teste no navegador: `node tests/e2e/etapa4.mjs qa`.

## Etapa 5: laudo de solo (concluída)

- Cálculos da seção 6 em `packages/regras/src/solo.ts` (K em cmolc, SB, CTC, V%, m%, calagem, gessagem na camada 20–40 cm, interpretação de P por argila e de K por CTC). As tabelas de interpretação ficam em `packages/regras/config/interpretacao-solo.json`, para o agrônomo ajustar.
- Equipe lança os resultados do laboratório (ou parte de um laudo enviado pelo produtor), vê a análise ao vivo e edita a recomendação sugerida. Só o admin aprova e envia; o PDF é gerado e guardado nesse momento.
- Produtor envia o laudo do laboratório (PDF ou foto) e baixa os PDFs dos laudos de solo e de safra já enviados.
- Depósito `documentos` com isolamento testado.

Teste no navegador: `node tests/e2e/etapa5.mjs qa` (precisa de `pdftotext` instalado).

## Demonstração

`dev/subir-tudo.sh` sobe o ambiente inteiro. `python3 dev/gerar-fotos-demo.py /tmp/demofotos && node dev/seed-demo.mjs /tmp/demofotos > /tmp/ids.json && node tests/e2e/demo.mjs /tmp/ids.json pasta-de-fotos` apaga os dados de desenvolvimento, cria um cenário fictício limpo e tira fotos das telas.
Contas de demonstração (senha `teste-123456`): `luciano@soloplan.local` (admin), `funcionario@soloplan.local`, `produtor1@exemplo.local`, `produtor2@exemplo.local`.

## Revisão de qualidade — 12/10/2026

Consulte `REVISAO.md`. `npm run check` roda lint, TypeScript, testes de regras e compilação; `npm test` roda regras e banco. Aplique **todas** as migrações (inclui `0800_integridade_e_transacoes` e `0900_fila_ia`) antes de subir o site. Não use `reset` em produção.
