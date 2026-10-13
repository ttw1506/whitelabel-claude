# IA do escritório (PC com Ollama)

Duas formas de usar a IA local com o Soloplan. As duas só criam **rascunhos**: nada chega ao produtor sem um administrador aprovar.

## 1. Open WebUI (conversando)
1. No Soloplan, entre como administrador → **Inteligência artificial** → crie o usuário da IA (uma vez) e uma **chave**. Copie a chave: ela aparece só uma vez.
2. No Open WebUI: Configurações → Ferramentas → adicionar servidor OpenAPI com a URL `https://SEU-SITE/api/ia/openapi.json` e a chave como *Bearer*.
3. Peça em linguagem normal: “registre a ocorrência de percevejo no talhão T3 da safra tal”. O que a IA registrar aparece como rascunho na tela da safra.

## 2. Programa automático (fila)
Quando alguém pede uma tarefa em **Inteligência artificial → Fila de tarefas**, este programa pega, escreve o texto com o Ollama e devolve como rascunho.

```
SOLOPLAN_URL=https://SEU-SITE SOLOPLAN_CHAVE=sp_ia_... node ia-local/worker.mjs
```
No Windows (PowerShell): `$env:SOLOPLAN_URL="..."; $env:SOLOPLAN_CHAVE="..."; node ia-local/worker.mjs`

Modelo padrão: `gemma4:e4b-it-qat` (texto e imagem), conforme a seção 2 de `COMO_A_IA_FUNCIONA.md`.
Para trocar: `OLLAMA_MODELO` e `OLLAMA_MODELO_VISAO`.

Hoje ele escreve **laudo parcial, laudo final, análise de foto e explicação do CAR**. A leitura de laudo de solo ainda é feita pelo Open WebUI (a tarefa fica na fila ou você a cancela na tela).
Falhou? A tarefa volta para a fila até 3 vezes e depois aparece como “Falhou”, com o motivo.

### Análise de foto

Responde nas partes **A, B e C** da seção 4 de `COMO_A_IA_FUNCIONA.md`:

- **A. O que se vê** — só o visível na foto.
- **B. Hipóteses** — até 3, cada uma com tipo (praga, doença, planta daninha, deficiência nutricional, dano físico ou climático, fitotoxidez), o que apoia, o que impede confirmar e a confiança (**baixa, média ou alta**, nunca porcentagem) com o motivo.
- **C. O que falta** — fotos, medições ou amostragens que separariam as hipóteses. Vai também para o campo `incertezas`.

Foto escura, desfocada ou distante marca **Inconclusivo** e para em A, B e C. As partes D (produtos registrados), E (adubação) e F (próximos passos) dependem da base Agrofit e da análise de solo do talhão, que ainda não existem.

O formato fica em `ia-local/foto.mjs`, com testes em `ia-local/foto.test.mjs` (`npm run test:ia`, não precisa do site nem do banco).
Para provar com o Ollama de verdade, sem tocar no banco: `node ia-local/foto-ollama.mjs [foto.jpg]`.

## Regras que valem sempre
- A IA **lê** números e **escreve** texto. Análise de solo e custos são calculados pelo sistema.
- Valores absurdos (pH 55, por exemplo) são recusados com a explicação.
- Revogou a chave na tela? Corta na hora.
