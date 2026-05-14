import { AppShell } from "@/components/app-shell";
import { requireAppUser } from "@/lib/rbac";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAppUser();
  return (
    <AppShell email={user.email} name={user.name} perfil={user.perfil}>
      {children}
    </AppShell>
  );
}
