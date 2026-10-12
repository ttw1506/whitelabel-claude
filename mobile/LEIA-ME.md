# App do celular · visita de campo (offline)

O técnico escolhe a safra, tira fotos e anota ocorrências **mesmo sem sinal**. Tudo fica guardado no celular e é enviado sozinho quando o sinal volta. Reenviar não duplica nada (cada registro tem um número único criado no celular).

## Como testar no seu celular
1. Instale **Node 22+** no computador e o app **Expo Go** no celular (mesmo Wi-Fi do computador).
2. `cd mobile && npm install`
3. Copie `.env.example` para `.env` e preencha:
   - `EXPO_PUBLIC_SUPABASE_URL`: endereço do Supabase (no teste local, `http://IP-DO-COMPUTADOR:54321`; em produção, o do projeto).
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: a chave "anon" (pública). **Nunca** a chave de serviço.
4. `npx expo start` e leia o código QR com o Expo Go.
5. Entre com um usuário **funcionário ou administrador** (produtor não registra visita).

## Teste do modo offline
Abra o app com internet uma vez (carrega as safras) → ative o modo avião → registre uma foto e uma ocorrência → desative o modo avião. O aviso no topo mostra “N para enviar” e some ao terminar. Confira no site, na tela da safra.

## Regras
- A foto vai com data e GPS quando a câmera gravar; cópia leve (até 1920 px). O original em tamanho cheio **não** é enviado por este app.
- Recusa do servidor (ex.: sem permissão) não fica repetindo: aparece em vermelho e você escolhe descartar.
- Foto de uma ocorrência só sobe depois da ocorrência.

## O que ainda não foi feito
- Nunca rodou em um aparelho de verdade (só foi empacotado e testado contra o servidor). Teste antes de usar em campo.
- Sem cadastro de aplicação/custo em campo, sem texto de voz e sem build para a loja (precisa das contas da Apple e do Google).
