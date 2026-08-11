import "server-only";
import { unstable_cache } from "next/cache";
import {
  conditionBreakdown,
  frotasByYear,
  kpis,
  localizacoesDistintas,
  modelosDistintos,
  setoresDistintos,
  statusBreakdown,
} from "@/lib/repos/frotas";

export const modelosDistintosCached = unstable_cache(
  async () => modelosDistintos(),
  ["frotas:modelos"],
  {
    revalidate: 600,
    tags: ["frotas:filters"],
  }
);

export const localizacoesDistintasCached = unstable_cache(
  async () => localizacoesDistintas(),
  ["frotas:localizacoes"],
  {
    revalidate: 600,
    tags: ["frotas:filters"],
  }
);

export const setoresDistintosCached = unstable_cache(
  async () => setoresDistintos(),
  ["frotas:setores:v2"],
  {
    revalidate: 600,
    tags: ["frotas:filters"],
  }
);

export const dashboardFrotasCached = unstable_cache(
  async () => {
    const [k, operational, conditions, byYear] = await Promise.all([
      kpis(),
      statusBreakdown(),
      conditionBreakdown(),
      frotasByYear(),
    ]);

    return { k, operational, conditions, byYear };
  },
  ["frotas:dashboard"],
  {
    revalidate: 60,
    tags: ["frotas:dashboard"],
  }
);
