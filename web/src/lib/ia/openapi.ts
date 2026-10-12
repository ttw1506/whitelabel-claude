// Descrição da API da IA (OpenAPI 3). O Open WebUI lê isto para criar as "ferramentas" da IA do escritório.
export function openapi(urlBase: string) {
  const erros = { "401": { description: "Chave ausente, inválida ou revogada." }, "422": { description: "Dados inválidos; veja `detalhes`." } };
  const seguranca = [{ chave: [] }];
  const idSafra = { name: "id", in: "path", required: true, description: "Id da safra", schema: { type: "string", format: "uuid" } };
  const corpo = (propriedades: object, obrigatorios: string[]) => ({
    required: true, content: { "application/json": { schema: { type: "object", required: obrigatorios, properties: propriedades } } },
  });
  const t = { type: "string" };
  const n = { type: "number" };
  return {
    openapi: "3.0.3",
    info: {
      title: "Soloplan Campo · API da IA do escritório",
      version: "1.0.0",
      description:
        "Tudo que a IA envia nasce como RASCUNHO e só chega ao produtor depois que um administrador aprova. " +
        "A IA lê números e escreve textos; as contas (análise de solo, custos) são feitas pelo sistema.",
    },
    servers: [{ url: urlBase }],
    components: { securitySchemes: { chave: { type: "http", scheme: "bearer", description: "Chave criada em Inteligência artificial > Chaves (começa com sp_ia_)." } } },
    security: seguranca,
    paths: {
      "/api/ia/tarefas/proxima": { get: {
        operationId: "pegar_proxima_tarefa", summary: "Pega a próxima tarefa da fila (204 se não houver).",
        parameters: [{ name: "tipos", in: "query", required: false, description: "Tipos separados por vírgula: extrair_laudo_solo, analisar_foto, gerar_laudo_parcial, gerar_laudo_final, conferir_car", schema: t }],
        responses: { "200": { description: "Tarefa reservada por 10 minutos." }, "204": { description: "Fila vazia." }, ...erros } } },
      "/api/ia/tarefas/{id}/concluir": { post: {
        operationId: "concluir_tarefa", summary: "Marca a tarefa como concluída.",
        parameters: [{ ...idSafra, description: "Id da tarefa" }], requestBody: corpo({ resultado: { type: "object" } }, []),
        responses: { "200": { description: "Tarefa concluída." }, "409": { description: "A tarefa não estava em andamento." }, ...erros } } },
      "/api/ia/tarefas/{id}/falhar": { post: {
        operationId: "falhar_tarefa", summary: "Informa que não deu certo; volta para a fila até 3 tentativas.",
        parameters: [{ ...idSafra, description: "Id da tarefa" }], requestBody: corpo({ erro: t }, ["erro"]),
        responses: { "200": { description: "Registrado." }, "409": { description: "A tarefa não estava em andamento." }, ...erros } } },
      "/api/ia/safras/{id}/contexto": { get: {
        operationId: "ler_contexto_da_safra", summary: "Dados da safra para escrever o laudo (ocorrências, aplicações, custos, fotos).",
        parameters: [idSafra], responses: { "200": { description: "Dados da safra." }, "404": { description: "Safra não encontrada." }, ...erros } } },
      "/api/ia/safras/{id}/ocorrencias": { post: {
        operationId: "registrar_ocorrencia", summary: "Registra praga, doença, planta daninha ou deficiência (rascunho).",
        parameters: [idSafra],
        requestBody: corpo({ tipo: { type: "string", enum: ["praga", "doenca", "planta_daninha", "deficiencia"] }, nome: t, data: { type: "string", format: "date" }, estadio: t, severidade: t, acao_tomada: t, talhao: { ...t, description: "Nome ou id do talhão" } }, ["tipo", "nome"]),
        responses: { "201": { description: "Criada como rascunho_ia." }, ...erros } } },
      "/api/ia/safras/{id}/aplicacoes": { post: {
        operationId: "registrar_aplicacao", summary: "Registra aplicação/operação de campo (rascunho). Custo informado vira lançamento de custo.",
        parameters: [idSafra],
        requestBody: corpo({ data: { type: "string", format: "date" }, tipo_operacao: t, talhoes: { type: "array", items: t }, produto: t, ingrediente_ativo: t, dose: n, dose_unidade: t, area_ha: n, custo: n, categoria_custo: t }, ["data", "tipo_operacao", "talhoes"]),
        responses: { "201": { description: "Criada como rascunho_ia." }, ...erros } } },
      "/api/ia/safras/{id}/custos": { post: {
        operationId: "registrar_custo", summary: "Registra um gasto da safra (rascunho).",
        parameters: [idSafra],
        requestBody: corpo({ categoria: { type: "string", enum: ["sementes", "fertilizantes_corretivos", "defensivos", "operacoes_maquinas", "outros"] }, descricao: t, valor: n, data: { type: "string", format: "date" } }, ["categoria", "descricao", "valor"]),
        responses: { "201": { description: "Criado como rascunho_ia." }, ...erros } } },
      "/api/ia/safras/{id}/laudos": { post: {
        operationId: "enviar_laudo_da_safra", summary: "Envia o texto do laudo parcial ou final para revisão.",
        parameters: [idSafra], requestBody: corpo({ tipo: { type: "string", enum: ["parcial", "final"] }, texto: t }, ["tipo", "texto"]),
        responses: { "201": { description: "Criado como rascunho_ia; aguarda aprovação do administrador." }, ...erros } } },
      "/api/ia/laudos-solo": { post: {
        operationId: "enviar_laudo_de_solo", summary: "Envia os números lidos do laudo do laboratório. O sistema calcula a análise.",
        requestBody: corpo({
          fazenda_id: t, talhao_id: t, envio_id: t, profundidade: { type: "string", enum: ["0-20", "20-40"] }, data_coleta: { type: "string", format: "date" }, laboratorio: t, prnt: n, v2: n,
          valores: { type: "object", description: "ph, p, k, ca, mg, al, hal, mo, argila (obrigatórios); s, b, cu, fe, mn, zn (opcionais)", additionalProperties: n },
        }, ["fazenda_id", "profundidade", "valores"]),
        responses: { "201": { description: "Criado como rascunho_ia." }, ...erros } } },
      "/api/ia/precos": { post: {
        operationId: "registrar_preco_do_dia", summary: "Registra a cotação do dia (soja, milho, boi) com a fonte.",
        requestBody: corpo({ produto: { type: "string", enum: ["soja", "milho", "boi"] }, valor: n, unidade: t, fonte: t, data: { type: "string", format: "date" } }, ["produto", "valor", "unidade", "fonte"]),
        responses: { "201": { description: "Criado como rascunho_ia." }, ...erros } } },
    },
  };
}
