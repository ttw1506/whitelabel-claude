import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { estadiosDa } from "../packages/regras/src/safra";
import { novoItem, resumoFila, type ItemFila } from "../packages/regras/src/fila-offline";
import { enfileirar, lerFila, removerBloqueado, sincronizar } from "./src/fila";
import { supabase } from "./src/supabase";

type Safra = { id: string; cliente_id: string; cultura: string; ano_agricola: string; fazendas: { nome: string } | null; safra_talhoes: { talhoes: { id: string; nome: string } | null }[] };
const TIPOS = [["praga", "Praga"], ["doenca", "Doença"], ["planta_daninha", "Planta daninha"], ["deficiencia", "Deficiência"]] as const;
const CACHE = "soloplan:safras:v1";

export default function App() {
  const [logado, setLogado] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_, s) => setLogado(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (logado === null) return <Centro><ActivityIndicator /></Centro>;
  return logado ? <Visita /> : <Entrar />;
}

const Centro = ({ children }: { children: React.ReactNode }) => <SafeAreaView style={[s.tela, { justifyContent: "center" }]}>{children}</SafeAreaView>;
const Botao = ({ texto, onPress, vazio, desligado }: { texto: string; onPress: () => void; vazio?: boolean; desligado?: boolean }) => (
  <Pressable accessibilityRole="button" onPress={onPress} disabled={desligado} style={[s.botao, vazio && s.botaoVazio, desligado && { opacity: 0.5 }]}>
    <Text style={[s.botaoTexto, vazio && { color: cor.verde }]}>{texto}</Text>
  </Pressable>
);
const Chip = ({ texto, ativo, onPress }: { texto: string; ativo: boolean; onPress: () => void }) => (
  <Pressable accessibilityRole="button" accessibilityState={{ selected: ativo }} onPress={onPress} style={[s.chip, ativo && s.chipAtivo]}><Text style={ativo ? { color: "#fff" } : undefined}>{texto}</Text></Pressable>
);

function Entrar() {
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState(""); const [erro, setErro] = useState<string>(); const [indo, setIndo] = useState(false);
  async function entrar() {
    setIndo(true); setErro(undefined);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) setErro(/network|fetch/i.test(error.message) ? "Sem internet. Para entrar pela primeira vez é preciso sinal." : "E-mail ou senha incorretos.");
    setIndo(false);
  }
  return (
    <Centro>
      <View style={s.conteudo}>
        <Text style={s.titulo}>Soloplan Campo</Text>
        <TextInput style={s.campo} placeholder="E-mail" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
        <TextInput style={s.campo} placeholder="Senha" secureTextEntry autoComplete="password" value={senha} onChangeText={setSenha} />
        {erro && <Text style={s.erro} accessibilityRole="alert">{erro}</Text>}
        <Botao texto={indo ? "Entrando…" : "Entrar"} onPress={entrar} desligado={indo || !email || !senha} />
      </View>
    </Centro>
  );
}

function Visita() {
  const [safras, setSafras] = useState<Safra[]>([]);
  const [safra, setSafra] = useState<Safra | null>(null);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [online, setOnline] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const enviar = useCallback(async () => { setEnviando(true); try { setFila(await sincronizar()); } finally { setEnviando(false); } }, []);

  useEffect(() => {
    lerFila().then(setFila);
    // Safras vêm da internet; sem sinal usa a última lista guardada no aparelho.
    (async () => {
      const { data, error } = await supabase.from("safras").select("id, cliente_id, cultura, ano_agricola, fazendas(nome), safra_talhoes(talhoes(id, nome))").eq("status", "em_andamento").order("ano_agricola", { ascending: false });
      if (!error && data) { setSafras(data as unknown as Safra[]); AsyncStorage.setItem(CACHE, JSON.stringify(data)); }
      else setSafras(JSON.parse((await AsyncStorage.getItem(CACHE)) ?? "[]"));
    })();
    return NetInfo.addEventListener((e) => { const on = !!e.isConnected && e.isInternetReachable !== false; setOnline(on); if (on) enviar(); });
  }, [enviar]);

  const r = resumoFila(fila);
  return (
    <SafeAreaView style={s.tela}>
      <View style={s.faixa}>
        <Text style={{ flex: 1 }}>{online ? "Com internet" : "Sem internet: tudo fica guardado no celular"}{r.total ? ` · ${r.pendentes} para enviar${r.bloqueados ? `, ${r.bloqueados} com problema` : ""}` : ""}</Text>
        {r.pendentes > 0 && online && <Botao texto={enviando ? "Enviando…" : "Enviar agora"} onPress={enviar} vazio desligado={enviando} />}
      </View>
      {r.bloqueados > 0 && (
        <View style={s.avisoBox}>
          {fila.filter((i) => i.bloqueado).map((i) => (
            <View key={i.id} style={{ marginBottom: 6 }}>
              <Text style={s.erro}>{i.tipo === "foto" ? "Foto" : "Ocorrência"} recusada: {i.erro}</Text>
              <Botao texto="Descartar" vazio onPress={() => Alert.alert("Descartar?", "Este registro será apagado do celular.", [{ text: "Não" }, { text: "Descartar", style: "destructive", onPress: async () => { await removerBloqueado(i.id); setFila(await lerFila()); } }])} />
            </View>
          ))}
        </View>
      )}
      {safra ? (
        <Registrar safra={safra} voltar={() => setSafra(null)} guardado={async () => { setFila(await lerFila()); if (online) enviar(); }} />
      ) : (
        <FlatList
          contentContainerStyle={s.conteudo} data={safras} keyExtractor={(x) => x.id}
          ListHeaderComponent={<><Text style={s.titulo}>Escolha a safra da visita</Text><Botao texto="Sair" vazio onPress={() => supabase.auth.signOut()} /></>}
          ListEmptyComponent={<Text style={s.muted}>Nenhuma safra em andamento. Abra o app com internet uma vez para carregar.</Text>}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" style={s.cartao} onPress={() => setSafra(item)}>
              <Text style={s.cartaoTitulo}>{item.fazendas?.nome ?? "Fazenda"}</Text>
              <Text style={s.muted}>{item.cultura} {item.ano_agricola}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Registrar({ safra, voltar, guardado }: { safra: Safra; voltar: () => void; guardado: () => Promise<void> }) {
  const talhoes = safra.safra_talhoes.map((x) => x.talhoes).filter((t): t is { id: string; nome: string } => !!t);
  const estadios = estadiosDa(safra.cultura);
  const [estadio, setEstadio] = useState(""); const [talhao, setTalhao] = useState<string | null>(null);
  const [foto, setFoto] = useState<{ uri: string; latitude: number | null; longitude: number | null; tirada_em: string } | null>(null);
  const [tipo, setTipo] = useState<string | null>(null); const [nome, setNome] = useState(""); const [nota, setNota] = useState("");
  const [msg, setMsg] = useState<string>();

  async function tirarFoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setMsg("Permita o uso da câmera nas configurações do celular.");
    const r = await ImagePicker.launchCameraAsync({ exif: true, quality: 1 });
    if (r.canceled) return;
    const a = r.assets[0];
    // Cópia leve (lado maior 1920) guardada em pasta que o sistema não limpa, para sobreviver até o envio.
    const leve = await ImageManipulator.manipulateAsync(a.uri, [{ resize: a.width >= a.height ? { width: 1920 } : { height: 1920 } }], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG });
    const destino = `${FileSystem.documentDirectory}foto-${randomUUID()}.jpg`;
    await FileSystem.copyAsync({ from: leve.uri, to: destino });
    const lat = Number(a.exif?.GPSLatitude), lon = Number(a.exif?.GPSLongitude);
    const ok = Number.isFinite(lat) && Number.isFinite(lon);
    const sinal = (ref: unknown) => (ref === "S" || ref === "W" ? -1 : 1);
    setFoto({ uri: destino, latitude: ok ? sinal(a.exif?.GPSLatitudeRef) * lat : null, longitude: ok ? sinal(a.exif?.GPSLongitudeRef) * lon : null, tirada_em: new Date().toISOString() });
  }

  async function salvar() {
    if (!foto && !nome.trim()) return setMsg("Tire uma foto ou descreva uma ocorrência.");
    if (foto && !estadio.trim()) return setMsg("Escolha o estádio da foto.");
    if (nome.trim() && !tipo) return setMsg("Escolha o tipo da ocorrência.");
    const agora = new Date();
    const ocorrenciaId = nome.trim() ? randomUUID() : undefined;
    if (ocorrenciaId) await enfileirar(novoItem("ocorrencia", safra.id, { tipo, nome: nome.trim(), estadio: estadio || null, talhao_id: talhao, acao_tomada: nota.trim() || null, data: agora.toISOString().slice(0, 10) }, agora, ocorrenciaId));
    if (foto) await enfileirar({ ...novoItem("foto", safra.id, { ...foto, cliente_id: safra.cliente_id, estadio, talhao_id: talhao, anotacao: nota.trim(), ocorrencia_id: ocorrenciaId }, agora, randomUUID()), depende_de: ocorrenciaId });
    setFoto(null); setNome(""); setNota(""); setTipo(null);
    setMsg("Guardado no celular. Será enviado quando houver internet.");
    await guardado();
  }

  return (
    <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
      <Botao texto="‹ Trocar safra" vazio onPress={voltar} />
      <Text style={s.titulo}>{safra.fazendas?.nome}</Text><Text style={s.muted}>{safra.cultura} {safra.ano_agricola}</Text>
      {talhoes.length > 0 && <><Text style={s.rotulo}>Talhão</Text><View style={s.linha}>{talhoes.map((t) => <Chip key={t.id} texto={t.nome} ativo={talhao === t.id} onPress={() => setTalhao(talhao === t.id ? null : t.id)} />)}</View></>}
      <Text style={s.rotulo}>Estádio</Text>
      {estadios ? <View style={s.linha}>{estadios.map((e) => <Chip key={e} texto={e} ativo={estadio === e} onPress={() => setEstadio(e)} />)}</View> : <TextInput style={s.campo} placeholder="Ex.: floração" value={estadio} onChangeText={setEstadio} />}
      <Text style={s.rotulo}>Foto</Text>
      {foto && <Image source={{ uri: foto.uri }} style={s.foto} accessibilityLabel="Foto tirada" />}
      <Botao texto={foto ? "Tirar outra foto" : "Tirar foto"} onPress={tirarFoto} vazio />
      <Text style={s.rotulo}>Ocorrência (opcional)</Text>
      <View style={s.linha}>{TIPOS.map(([v, n]) => <Chip key={v} texto={n} ativo={tipo === v} onPress={() => setTipo(v)} />)}</View>
      <TextInput style={s.campo} placeholder="O que foi encontrado (ex.: percevejo-marrom)" value={nome} onChangeText={setNome} />
      <TextInput style={[s.campo, { minHeight: 70 }]} multiline placeholder="Anotação ou ação tomada" value={nota} onChangeText={setNota} />
      {msg && <Text style={s.muted} accessibilityRole="alert">{msg}</Text>}
      <Botao texto="Salvar registro" onPress={salvar} />
    </ScrollView>
  );
}

const cor = { verde: "#1f6b3a", fundo: "#f4f6f1", texto: "#1d2a22", borda: "#cfd8cc", erro: "#b3261e" };
const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo }, conteudo: { padding: 16, gap: 10 },
  titulo: { fontSize: 22, fontWeight: "700", color: cor.texto }, muted: { color: "#5b6b60" }, rotulo: { fontWeight: "600", marginTop: 8, color: cor.texto },
  campo: { backgroundColor: "#fff", borderWidth: 1, borderColor: cor.borda, borderRadius: 10, padding: 12, fontSize: 16 },
  botao: { backgroundColor: cor.verde, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", minHeight: 48, justifyContent: "center" },
  botaoVazio: { backgroundColor: "transparent", borderWidth: 1, borderColor: cor.verde }, botaoTexto: { color: "#fff", fontWeight: "600", fontSize: 16 },
  chip: { borderWidth: 1, borderColor: cor.borda, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "#fff", minHeight: 40, justifyContent: "center" },
  chipAtivo: { backgroundColor: cor.verde, borderColor: cor.verde }, linha: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cartao: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: cor.borda, marginTop: 8 }, cartaoTitulo: { fontSize: 18, fontWeight: "600" },
  faixa: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: "#e6eee4" }, avisoBox: { padding: 12, backgroundColor: "#fdecea" },
  erro: { color: cor.erro, fontWeight: "600" }, foto: { width: "100%", height: 220, borderRadius: 10 },
});
