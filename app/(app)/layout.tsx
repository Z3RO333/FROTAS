import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { normalizeUserDisplayName } from "@/lib/user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const displayName = normalizeUserDisplayName(session.user.name, session.user.email);
  return (
    <AppShell email={session.user.email} name={displayName}>
      {children}
    </AppShell>
  );
}
