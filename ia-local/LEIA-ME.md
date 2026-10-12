# IA do escritório (PC com Ollama)

Duas formas de usar a IA local com o Soloplan. As duas só criam **rascunhos**: nada chega ao produtor sem um administrador aprovar.

## 1. Open WebUI (conversando)
1. No Soloplan, entre como administrador → **Inteligência artificial** → crie o usuário da IA (uma vez) e uma **chave**. Copie a chave: ela aparece só uma vez.
2. No Open WebUI: Configurações → Ferramentas → adicionar servidor OpenAPI com a URL `https://SEU-SITE/api/ia/openapi.json` e a chave como *Bearer*.
3. Peça em linguagem normal: “registre a ocorrência de percevejo no talhão T3 da safra tal”. O que a IA registrar aparece como rascunho na tela da safra.

## 2. Programa automático (fila)
Quando alguém pede uma tarefa em **Inteligência artificial → Fila de tarefas**, este programa pega, escreve o texto com o Ollama e devolve como rascunho.

```
SOLOPLAN_URL=https://SEU-SITE SOLOPLAN_CHAVE=sp_ia_... OLLAMA_MODELO=llama3.1 node ia-local/worker.mjs
```
No Windows (PowerShell): `$env:SOLOPLAN_URL="..."; $env:SOLOPLAN_CHAVE="..."; node ia-local/worker.mjs`

Hoje ele escreve **laudo parcial e laudo final**. Leitura de laudo de solo, análise de foto e conferência do CAR ainda são feitas pelo Open WebUI (a tarefa fica na fila ou você a cancela na tela).
Falhou? A tarefa volta para a fila até 3 vezes e depois aparece como “Falhou”, com o motivo.

## Regras que valem sempre
- A IA **lê** números e **escreve** texto. Análise de solo e custos são calculados pelo sistema.
- Valores absurdos (pH 55, por exemplo) são recusados com a explicação.
- Revogou a chave na tela? Corta na hora.
