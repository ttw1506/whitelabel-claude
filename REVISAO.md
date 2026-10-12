# Revisão do Soloplan Campo

Revisão realizada em 12/10/2026 sobre o ZIP fornecido. O original foi preservado.

## Avaliação

O projeto tem uma base boa: TypeScript, regras compartilhadas separadas da interface, permissões no banco e testes de isolamento. A revisão encontrou e corrigiu erros de integridade, validação e ferramentas. A versão corrigida passou nas verificações descritas abaixo, mas isso não garante ausência de todos os erros nem substitui uma homologação com o Supabase completo.

## Correções

1. O comando `next lint` foi substituído por ESLint, compatível com Next.js 15. A configuração ignora os arquivos gerados.
2. Foram adicionados comandos de TypeScript, compilação e verificação conjunta na raiz.
3. Safras e seus talhões agora são salvos em uma única transação do PostgreSQL. Edições simultâneas da mesma safra são serializadas pelo bloqueio do registro.
4. Aplicações, talhões e custo automático também são salvos em uma única transação. A implementação anterior tentava apagar registros após uma falha, mas funcionários não têm essa permissão.
5. As funções de salvamento usam `security invoker`, verificam o papel e mantêm RLS. Não usam a chave administrativa. Talhões repetidos são deduplicados.
6. Os pedidos agora conferem a fazenda exata da safra. Comparar apenas o cliente permitia misturar duas fazendas do mesmo produtor. Os vínculos e o tipo de um pedido existente não podem ser alterados.
7. O banco impede vínculos de fotos com ocorrências de outra safra, laudos com envios de outra fazenda e custos com aplicações de outra safra. Custos derivados não podem ser inseridos manualmente para uma aplicação.
8. Editar conteúdo de um laudo aprovado/enviado exige nova revisão, limpa os carimbos de aprovação e invalida a referência ao PDF anterior. Novos PDFs usam caminhos únicos; o botão de envio rejeita laudos já enviados.
9. Datas são validadas como dias reais de calendário, incluindo anos bissextos. Datas como 30/02 não são mais aceitas pela validação.
10. A análise de solo rejeita pH acima de 14, argila acima de 100%, profundidade desconhecida e micronutrientes negativos ou não finitos. Os limites são conferidos no formulário do servidor e nas regras compartilhadas.
11. O registro de fotos confere o prefixo completo do cliente e da safra, inclusive o caminho do original, e rejeita componentes de caminho inválidos.
12. O envio de laudo pelo produtor recupera o estado do botão em caso de exceção, por meio de `try/catch/finally`.
13. PDFs quebram textos longos nas células e palavras extensas, respeitando as larguras e a paginação. Caracteres de controle incompatíveis com a fonte são tratados.
14. Vitest foi atualizado para 4.1.11; tar foi fixado em 7.5.22 e PostCSS em 8.5.29 por overrides. O arquivo de dependências travadas foi regenerado. Foi declarado Node.js 22.12+.
15. Foram adicionados testes de regressão para datas, solo, PDFs, transações, vínculos e nova revisão de laudos.

## Verificação

- Lint: aprovado, sem avisos.
- TypeScript: aprovado.
- Regras, datas e PDFs: 56 testes aprovados.
- Banco PostgreSQL 17.11: 20 testes aprovados, com todas as oito migrações aplicadas em banco descartável.
- Compilação Next.js para produção: aprovada.
- Auditoria npm: os 3 alertas críticos iniciais foram eliminados; permanecem 5 alertas altos, todos na cadeia de ferramentas de lint (`braces`, `micromatch`, `fast-glob`, plugin ESLint do Next e configuração ESLint do Next). Os cinco alertas derivam do mesmo problema de recursão em `braces` 3.0.3; a versão mais recente consultada desse pacote ainda é 3.0.3. Não foi feito downgrade automático do Next/ESLint para ocultar o alerta.

Os registros estão em `verificacao/`. Esses resultados valem para a versão entregue e o ambiente de teste descrito.

## Uso desta versão

1. Use Node.js 22.12 ou superior e execute `npm ci` na raiz.
2. Configure `web/.env.local` usando `web/.env.example`. Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no navegador.
3. Aplique as migrações no Supabase, incluindo **20261012000800_integridade_e_transacoes.sql**, antes de subir esta versão do site. Em projeto já vinculado, use `supabase db push`. As novas ações dependem das funções criadas nessa migração.
4. Execute `npm run check`.
5. Para testes de banco, defina `TEST_DATABASE_URL` apontando para um PostgreSQL de teste cujo usuário possa criar bancos e execute `npm test`.

## O que ainda precisa de homologação

- Os passeios completos em navegador (`tests/e2e/`) e a integração com arquivos não foram executados nesta revisão: exigem os serviços de Auth, REST e Storage do Supabase e usuários de demonstração. Os testes de banco usam o shim de Auth e não instalam o Storage; portanto não validam as políticas reais de arquivos.
- Os scripts locais dependem de binários instalados em caminhos específicos de outra máquina. O ZIP não contém GoTrue, PostgREST e Storage. O README explica essa limitação e alternativas com Supabase CLI ou projeto remoto.
- Upload para Storage e gravação no PostgreSQL não formam uma transação única. Uma falha após upload ainda pode deixar um arquivo sem registro. Convém implementar limpeza de arquivos órfãos antes de uso intensivo.
- Links de arquivos já assinados podem continuar funcionando até expirar, mesmo após retirar o laudo da visão do cliente. A revisão invalida sua referência no banco, mas não revoga links emitidos anteriormente.
- O envio de PDF ainda exige homologação de concorrência entre geração, edição e publicação: a geração no servidor e o upload não estão na mesma transação da alteração de status.
- As tabelas e recomendações agronômicas foram preservadas. A revisão conferiu validações e testes de cálculo; a adequação técnica das recomendações deve ser homologada pelo agrônomo responsável.

O pacote não inclui dependências instaladas, build, credenciais ou dados do banco.
