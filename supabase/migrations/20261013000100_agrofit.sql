-- Soloplan Campo · cópia local do Agrofit (dados abertos do MAPA, licença Creative Commons
-- Attribution). Serve à parte D da seção 4: produtos registrados para AQUELA cultura e
-- AQUELE alvo. É dado público de referência, igual para todos os clientes: não tem dono,
-- todo mundo que entrou lê, e só o service_role escreve (a carga é feita pelo importador).
--
-- O que a origem NÃO tem, e por isso não existe aqui: bula e intervalo de segurança.
-- O grupo químico é extraído do ingrediente ativo e NÃO é o código oficial HRAC/IRAC/FRAC.
-- A tabela só traz registros ativos: produto cancelado simplesmente não aparece.

create table public.agrofit_produtos (
  id bigint generated always as identity primary key,
  registro text not null,
  marca text not null,
  formulacao text,
  ingrediente_ativo text,
  titular text,
  classe text,
  modo_de_acao text,
  grupo_quimico text,
  cultura text not null,
  cultura_norm text not null,
  alvo_comum text,
  alvo_cientifico text,
  alvo_norm text not null default '',
  classe_toxicologica text,
  classe_ambiental text,
  organicos text
);
create index on public.agrofit_produtos (cultura_norm);
create index on public.agrofit_produtos (cultura_norm, alvo_norm);
create index on public.agrofit_produtos (lower(marca), cultura_norm);
create index on public.agrofit_produtos (cultura_norm, grupo_quimico);

-- Procedência da cópia: fonte, endereço, data do download e as limitações conhecidas.
-- Vai junto de toda resposta que citar produto.
create table public.agrofit_origem (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);

alter table public.agrofit_produtos enable row level security;
alter table public.agrofit_origem enable row level security;

-- Dado público de referência: quem entrou no sistema lê. Ninguém grava pela API;
-- a carga é feita pelo importador, que usa a chave de serviço.
create policy agrofit_produtos_leitura on public.agrofit_produtos
  for select to authenticated using (true);
create policy agrofit_origem_leitura on public.agrofit_origem
  for select to authenticated using (true);

-- unaccent não vem por padrão em todo Postgres gerenciado; esta versão cobre o português.
create function public.unaccent_simples(texto text) returns text
language sql immutable parallel safe as $$
  select translate(coalesce(texto, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC');
$$;

-- Normaliza do mesmo jeito que o importador: sem acento, em minúsculas.
create function app.agrofit_normalizar(texto text) returns text
language sql immutable parallel safe as $$
  select lower(trim(public.unaccent_simples(coalesce(texto, ''))));
$$;

/**
 * Confere se um produto citado está na base para aquela cultura.
 * É a trava da seção 5: produto fora da base não é aceito.
 */
create function app.agrofit_conferir(p_marca text, p_registro text, p_cultura text)
returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.agrofit_produtos
    where lower(marca) = lower(trim(coalesce(p_marca, '')))
      and registro = trim(coalesce(p_registro, ''))
      and cultura_norm = app.agrofit_normalizar(p_cultura)
  ) and trim(coalesce(p_marca, '')) <> '' and trim(coalesce(p_registro, '')) <> '';
$$;

/** Produtos registrados para a cultura e, quando informado, para o alvo. */
create function app.agrofit_consultar(p_cultura text, p_alvo text default '', p_limite int default 30)
returns table (registro text, marca text, ingrediente_ativo text, classe text,
               grupo_quimico text, alvo_comum text, alvo_cientifico text,
               classe_toxicologica text, classe_ambiental text)
language sql stable security definer set search_path = public, app as $$
  select p.registro, p.marca, p.ingrediente_ativo, p.classe, p.grupo_quimico,
         p.alvo_comum, p.alvo_cientifico, p.classe_toxicologica, p.classe_ambiental
  from public.agrofit_produtos p
  where app.agrofit_normalizar(p_cultura) <> ''
    and p.cultura_norm = app.agrofit_normalizar(p_cultura)
    -- O alvo é quebrado em palavras e TODAS precisam aparecer: no Agrofit o nome vem
    -- como 'ferrugem da soja;  ferrugem "asiatica" phakopsora pachyrhizi', então
    -- procurar a frase inteira como um pedaço só não acha nada.
    and coalesce((
      select bool_and(p.alvo_norm like '%' || palavra || '%')
      from unnest(string_to_array(app.agrofit_normalizar(p_alvo), ' ')) as palavra
      where length(palavra) > 2
    ), true)
  order by p.marca
  limit greatest(1, least(coalesce(p_limite, 30), 200));
$$;

-- Só authenticated precisa de grant explícito: o service_role já recebe tudo em public
-- pelo preparo do ambiente, e no banco de teste ele nem existe.
grant execute on function app.agrofit_conferir(text, text, text) to authenticated;
grant execute on function app.agrofit_consultar(text, text, int) to authenticated;
grant execute on function app.agrofit_normalizar(text) to authenticated;
grant execute on function public.unaccent_simples(text) to authenticated;
