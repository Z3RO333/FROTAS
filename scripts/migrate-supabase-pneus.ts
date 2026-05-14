import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

// Origem: projeto gestao-pneus (olqngohdioglrxqalffh)
const ORIGEM_URL = "https://olqngohdioglrxqalffh.supabase.co";
const DESTINO_URL = process.env.SUPABASE_MANUTENCAO_URL!;

const origem = createClient(ORIGEM_URL, process.env.SUPABASE_PNEUS_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const destino = createClient(DESTINO_URL, process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE = 1000;

// Mapeia colunas que precisam ser renomeadas na migração (fonte → destino)
const COL_RENAME: Record<string, Record<string, string>> = {
  trocas_pneus_app:   { id_troca: "id_troca" },
  alinhamentos_app:   { id_alinhamento: "id_alinhamento" },
  lavagens_app:       { id_lavagem: "id_lavagem" },
  // numero_fogo: id UUID da fonte vai para id_origem no destino (nosso id é bigserial)
  numero_fogo:        { id: "id_origem" },
};

// Colunas a excluir do destino (incompatíveis)
const COL_EXCLUDE: Record<string, Set<string>> = {
  numero_fogo: new Set(["id"]),  // nosso id é bigserial, não pode receber UUID
};

async function migrarTabela(nomeTabela: string, onConflict: string) {
  console.log(`\n→ Migrando ${nomeTabela}...`);
  let offset = 0;
  let total = 0;
  let erros = 0;

  const renameMap = COL_RENAME[nomeTabela] ?? {};
  const excludeSet = COL_EXCLUDE[nomeTabela] ?? new Set<string>();

  while (true) {
    const { data, error } = await origem
      .from(nomeTabela)
      .select("*")
      .range(offset, offset + PAGE - 1);

    // Transformar colunas se necessário
    const transformed = (data ?? []).map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(row)) {
        if (excludeSet.has(key)) continue;          // excluir coluna incompatível
        const newKey = renameMap[key] ?? key;        // renomear se mapeado
        out[newKey] = val;
      }
      return out;
    });

    if (error) {
      console.error(`  Erro ao ler ${nomeTabela}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;

    const { error: errInsert } = await destino
      .from(nomeTabela)
      .upsert(transformed, { onConflict });

    if (errInsert) {
      console.warn(`  Erro no lote, tentando row-by-row: ${errInsert.message}`);
      for (const row of transformed) {
        const { error: e } = await destino.from(nomeTabela).upsert(row, { onConflict });
        if (e) { console.warn(`  Skip: ${e.message}`); erros++; }
        else total++;
      }
    } else {
      total += data.length;
    }

    offset += PAGE;
    if (data.length < PAGE) break;
  }

  const status = erros > 0 ? `${total} ok, ${erros} erros` : `${total} ok`;
  console.log(`  ✓ ${nomeTabela}: ${status}`);
}

async function main() {
  if (!process.env.SUPABASE_PNEUS_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_PNEUS_SERVICE_ROLE_KEY não definida no .env");
    process.exit(1);
  }
  if (!process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY não definida no .env");
    process.exit(1);
  }

  console.log("=== Migração gestao-pneus → plataforma unificada ===");
  console.log(`  Origem: ${ORIGEM_URL}`);
  console.log(`  Destino: ${DESTINO_URL}\n`);

  // Ordem importa pelas FKs: veiculos primeiro, depois servicos, depois subtabelas
  await migrarTabela("veiculos", "codigo_frota");
  await migrarTabela("servicos_app", "id_servico");
  await migrarTabela("trocas_pneus_app", "id_troca");
  await migrarTabela("alinhamentos_app", "id_alinhamento");
  await migrarTabela("lavagens_app", "id_lavagem");
  await migrarTabela("servicos_km_base_app", "id_veiculo,tipo_servico");
  await migrarTabela("numero_fogo", "id_origem");
  await migrarTabela("equipamentos_app", "id");
  await migrarTabela("equipamentos_preventivas_app", "id");
  await migrarTabela("equipamentos_componentes_app", "id");
  await migrarTabela("operacao_motoristas_app", "id");
  await migrarTabela("operacao_permissoes_app", "id");
  await migrarTabela("operacao_demandas_app", "id");
  await migrarTabela("operacao_demandas_adm_app", "id");
  await migrarTabela("operacao_oficinas_app", "id");
  await migrarTabela("operacao_oficina_registros_app", "id");
  await migrarTabela("operacao_motoristas_localizacao_app", "id");
  await migrarTabela("operacao_motoristas_localizacao_historico_app", "id");

  console.log("\n✅ Migração de pneus/manutenção concluída.");
}

main().catch((e) => { console.error(e); process.exit(1); });
