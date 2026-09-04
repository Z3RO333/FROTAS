import { Truck } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PedidosPecasTabs } from "@/components/manutencao/pedidos-pecas-tabs";
import { listFornecedoresPecas, type FornecedorPecas } from "@/lib/repos/fornecedores-pecas";
import { requireManutencaoUser } from "@/lib/rbac";
import { atualizarFornecedorPecasAction, criarFornecedorPecasAction } from "./_actions";

export const dynamic = "force-dynamic";

export default async function FornecedoresPecasPage({
  searchParams,
}: {
  searchParams: Promise<{ sucesso?: string; erro?: string }>;
}) {
  await requireManutencaoUser();
  const [fornecedores, sp] = await Promise.all([listFornecedoresPecas(), searchParams]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manutenção"
        title="Fornecedores de peças"
        description="Quem pode receber cotações nos Pedidos de peças."
        icon={Truck}
        severity="INFO"
      />

      <PedidosPecasTabs />

      {sp.sucesso ? <Alert tone="success" message={sp.sucesso} /> : null}
      {sp.erro ? <Alert tone="danger" message={sp.erro} /> : null}

      <Card>
        <CardHeader className="border-b bg-white">
          <CardTitle className="text-lg">Novo fornecedor</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <form action={criarFornecedorPecasAction} className="grid gap-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="novo-fornecedor-nome">Nome</Label>
              <Input id="novo-fornecedor-nome" name="nome" placeholder="Ex.: Peças Rio" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="novo-fornecedor-email">E-mail</Label>
              <Input id="novo-fornecedor-email" name="email" type="email" placeholder="vendas@fornecedor.com.br" required />
            </div>
            <SubmitButton pendingLabel="Adicionando...">Adicionar</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <SectionHeader title="Fornecedores cadastrados" description={`${fornecedores.length} fornecedor(es).`} />
        {fornecedores.length === 0 ? (
          <EmptyState icon={Truck} title="Nenhum fornecedor cadastrado" description="Adicione o primeiro fornecedor acima." />
        ) : (
          <div className="divide-y rounded-md border bg-white shadow-sm">
            {fornecedores.map((fornecedor) => (
              <FornecedorRow key={fornecedor.id} fornecedor={fornecedor} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FornecedorRow({ fornecedor }: { fornecedor: FornecedorPecas }) {
  return (
    <form
      action={atualizarFornecedorPecasAction}
      className="grid gap-3 p-4 sm:grid-cols-[1fr_1.2fr_auto_auto] sm:items-center"
    >
      <input type="hidden" name="id" value={fornecedor.id} />

      <div>
        <MobileLabel>Nome</MobileLabel>
        <Input name="nome" defaultValue={fornecedor.nome} />
      </div>

      <div>
        <MobileLabel>E-mail</MobileLabel>
        <Input name="email" type="email" defaultValue={fornecedor.email} />
      </div>

      <div>
        <MobileLabel>Status</MobileLabel>
        <input type="hidden" name="ativo" value="false" />
        <label
          className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm transition-colors ${
            fornecedor.ativo
              ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          <input
            type="checkbox"
            name="ativo"
            value="true"
            defaultChecked={fornecedor.ativo}
            className="h-4 w-4 accent-emerald-600"
          />
          <span className="font-medium">{fornecedor.ativo ? "Ativo" : "Inativo"}</span>
        </label>
      </div>

      <SubmitButton pendingLabel="Salvando..." variant="outline" size="sm">
        Salvar
      </SubmitButton>
    </form>
  );
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:hidden">{children}</div>;
}

function Alert({ tone, message }: { tone: "success" | "danger"; message: string }) {
  return (
    <div
      className={
        tone === "success"
          ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          : "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      }
    >
      {message}
    </div>
  );
}
