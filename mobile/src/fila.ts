// Guarda a fila no aparelho e manda para o Supabase. Tudo que o app registra passa por aqui, com ou sem internet.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { sincronizarFila, type ItemFila, type ResultadoEnvio } from "../../packages/regras/src/fila-offline";
import { supabase } from "./supabase";

const CHAVE = "soloplan:fila:v1";
export const lerFila = async (): Promise<ItemFila[]> => JSON.parse((await AsyncStorage.getItem(CHAVE)) ?? "[]");
const gravarFila = (f: ItemFila[]) => AsyncStorage.setItem(CHAVE, JSON.stringify(f));
export async function enfileirar(item: ItemFila) { await gravarFila([...(await lerFila()), item]); }

type Erro = { message: string; code?: string; status?: number; statusCode?: string | number } | null;
function resultado(error: Erro, status?: number): ResultadoEnvio {
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: true }; // já chegou numa tentativa anterior
  const codigo = Number(error.status ?? error.statusCode ?? status ?? 0);
  const semRede = /network|fetch|timeout|offline/i.test(error.message);
  return { ok: false, status: semRede ? 0 : codigo, mensagem: error.message };
}

async function enviarItem(i: ItemFila): Promise<ResultadoEnvio> {
  const p = i.payload as Record<string, any>;
  if (i.tipo === "ocorrencia") {
    const { error, status } = await supabase.from("ocorrencias").insert({ id: i.id, safra_id: i.safra_id, ...p });
    return resultado(error, status);
  }
  const caminho = `clientes/${p.cliente_id}/safras/${i.safra_id}/${i.id}.jpg`;
  const base64 = await FileSystem.readAsStringAsync(p.uri, { encoding: "base64" });
  const up = await supabase.storage.from("fotos").upload(caminho, decode(base64), { contentType: "image/jpeg", upsert: true });
  if (up.error) return resultado(up.error as Erro);
  const { error, status } = await supabase.from("fotos").insert({
    id: i.id, safra_id: i.safra_id, talhao_id: p.talhao_id, ocorrencia_id: p.ocorrencia_id ?? null, estadio: p.estadio,
    anotacao: p.anotacao || null, tirada_em: p.tirada_em, latitude: p.latitude, longitude: p.longitude, arquivo_path: caminho,
  });
  if (!error || error.code === "23505") await FileSystem.deleteAsync(p.uri, { idempotent: true });
  return resultado(error, status);
}

let rodando = false;
/** Manda o que der. Chamado ao abrir o app, ao voltar o sinal e no botão "Enviar agora". */
export async function sincronizar(): Promise<ItemFila[]> {
  if (rodando) return lerFila();
  rodando = true;
  try {
    const antes = await lerFila();
    const depois = await sincronizarFila(antes, enviarItem);
    // O que foi registrado durante o envio não pode se perder: entra na fila final.
    const vistos = new Set(antes.map((i) => i.id));
    await gravarFila([...depois, ...(await lerFila()).filter((i) => !vistos.has(i.id))]);
    return lerFila();
  } finally { rodando = false; }
}

export async function removerBloqueado(id: string) { await gravarFila((await lerFila()).filter((i) => i.id !== id)); }
