import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PERFIL_LABELS, PERFIS_USUARIO, isPerfilUsuario, type PerfilUsuario } from "@/lib/perfis";
import { canManageUsers, requireAppUser } from "@/lib/rbac";
import { listUsuarios, type UsuarioApp } from "@/lib/repos/usuarios";
import { formatDate } from "@/lib/utils";
import { createUsuarioAction, updateUsuarioAction } from "./_actions";

export const dynamic = "force-dynamic";

type SearchParams = {
  search?: string;
  perfil?: string;
  ativo?: string;
  sucesso?: string;
  erro?: string;
};

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireAppUser();
  if (!canManageUsers(actor.perfil)) redirect("/");

  const sp = await searchParams;
  const perfil = isPerfilUsuario(sp.perfil) ? sp.perfil : undefined;
  const ativo = sp.ativo === "inativos" || sp.ativo === "todos" ? sp.ativo : "ativos";
  const usuarios = await listUsuarios({ search: sp.search, perfil, ativo });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Administração</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Usuários e cargos</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Perfis agora são definidos manualmente no banco. O e-mail corporativo autentica a pessoa,
            mas quem decide o cargo no FROTAS é esta tela.
          </p>
        </div>
        <Badge variant="outline" className="w-fit bg-white px-3 py-1 text-slate-700">
          {usuarios.length} usuário(s)
        </Badge>
      </div>

      {sp.sucesso ? <Alert tone="success" message={sp.sucesso} /> : null}
      {sp.erro ? <Alert tone="danger" message={sp.erro} /> : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-white">
          <CardTitle className="text-lg">Novo usuário</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <form action={createUsuarioAction} className="grid gap-3 lg:grid-cols-[1.1fr_1.2fr_.8fr_.8fr_auto] lg:items-end">
            <Field label="Nome">
              <Input name="nome" placeholder="Nome da pessoa" />
            </Field>
            <Field label="E-mail">
              <Input name="email" type="email" placeholder="nome@bemol.com.br" required />
            </Field>
            <Field label="Matrícula">
              <Input name="matricula" placeholder="Opcional" />
            </Field>
            <Field label="Cargo">
              <PerfilSelect name="perfil" defaultValue="MOTORISTA" />
            </Field>
            <div className="flex items-center gap-3 lg:pb-0.5">
              <input type="hidden" name="ativo" value="false" />
              <label className="flex h-10 items-center gap-2 rounded-md border bg-white px-3 text-sm">
                <input type="checkbox" name="ativo" value="true" defaultChecked className="h-4 w-4" />
                Ativo
              </label>
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-lg">Usuários cadastrados</CardTitle>
            <form className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px_150px_auto]" action="/administracao/usuarios">
              <Input name="search" placeholder="Buscar nome, e-mail ou matrícula" defaultValue={sp.search ?? ""} />
              <PerfilSelect name="perfil" defaultValue={perfil ?? ""} includeAll />
              <select
                name="ativo"
                defaultValue={ativo}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ativos">Ativos</option>
                <option value="inativos">Inativos</option>
                <option value="todos">Todos</option>
              </select>
              <Button type="submit" variant="outline">Filtrar</Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[1.2fr_1.3fr_.7fr_.75fr_.6fr_.75fr_auto] lg:gap-3">
            <span>Nome</span>
            <span>E-mail</span>
            <span>Matrícula</span>
            <span>Cargo</span>
            <span>Status</span>
            <span>Criado em</span>
            <span className="text-right">Ação</span>
          </div>

          {usuarios.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
          ) : (
            <div className="divide-y">
              {usuarios.map((usuario) => (
                <UsuarioRow
                  key={usuario.id}
                  usuario={usuario}
                  actorPerfil={actor.perfil}
                  isSelf={usuario.email === actor.email}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsuarioRow({
  usuario,
  actorPerfil,
  isSelf,
}: {
  usuario: UsuarioApp;
  actorPerfil: PerfilUsuario;
  isSelf: boolean;
}) {
  const canEditDev = actorPerfil === "DEV" || usuario.perfil !== "DEV";

  return (
    <form
      action={updateUsuarioAction}
      className="grid gap-3 p-4 lg:grid-cols-[1.2fr_1.3fr_.7fr_.75fr_.6fr_.75fr_auto] lg:items-center"
    >
      <input type="hidden" name="id" value={usuario.id} />

      <div>
        <MobileLabel>Nome</MobileLabel>
        <Input name="nome" defaultValue={usuario.nome ?? ""} disabled={!canEditDev} />
      </div>

      <div>
        <MobileLabel>E-mail</MobileLabel>
        {/* Email é imutável: é o identificador de login Microsoft */}
        <input type="hidden" name="email" value={usuario.email} />
        <div className="flex h-10 items-center truncate rounded-md border bg-slate-50 px-3 text-sm text-muted-foreground">
          {usuario.email}
        </div>
      </div>

      <div>
        <MobileLabel>Matrícula</MobileLabel>
        <Input name="matricula" defaultValue={usuario.matricula ?? ""} disabled={!canEditDev} />
      </div>

      <div>
        <MobileLabel>Cargo</MobileLabel>
        <PerfilSelect name="perfil" defaultValue={usuario.perfil} disabled={!canEditDev} allowDev={actorPerfil === "DEV"} />
      </div>

      <div>
        <MobileLabel>Status</MobileLabel>
        <input type="hidden" name="ativo" value="false" />
        <label className="flex h-10 items-center gap-2 rounded-md border bg-white px-3 text-sm">
          <input
            type="checkbox"
            name="ativo"
            value="true"
            defaultChecked={usuario.ativo}
            disabled={!canEditDev || isSelf}
            className="h-4 w-4"
          />
          {usuario.ativo ? "Ativo" : "Inativo"}
        </label>
      </div>

      <div>
        <MobileLabel>Criado em</MobileLabel>
        <div className="flex h-10 items-center text-sm text-muted-foreground">{formatDate(usuario.criado_em)}</div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="outline" disabled={!canEditDev}>
          Salvar
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function PerfilSelect({
  name,
  defaultValue,
  includeAll = false,
  disabled = false,
  allowDev = true,
}: {
  name: string;
  defaultValue: PerfilUsuario | "";
  includeAll?: boolean;
  disabled?: boolean;
  allowDev?: boolean;
}) {
  const perfis = allowDev ? PERFIS_USUARIO : PERFIS_USUARIO.filter((perfil) => perfil !== "DEV");

  return (
    <select
      name={name}
      defaultValue={defaultValue}
      disabled={disabled}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
    >
      {includeAll ? <option value="">Todos os cargos</option> : null}
      {perfis.map((perfil) => (
        <option key={perfil} value={perfil}>
          {PERFIL_LABELS[perfil]}
        </option>
      ))}
    </select>
  );
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">{children}</div>;
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
