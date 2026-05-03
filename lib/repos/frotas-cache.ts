import "server-only";
import { unstable_cache } from "next/cache";
import {
  conditionBreakdown,
  kpis,
  localizacoesDistintas,
  modelosDistintos,
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

export const dashboardFrotasCached = unstable_cache(
  async () => {
    const [k, operational, conditions] = await Promise.all([
      kpis(),
      statusBreakdown(),
      conditionBreakdown(),
    ]);

    return { k, operational, conditions };
  },
  ["frotas:dashboard"],
  {
    revalidate: 60,
    tags: ["frotas:dashboard"],
  }
);
