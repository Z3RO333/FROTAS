import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AcessoBloqueadoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Acesso bloqueado</p>
        <h1 className="mt-3 text-2xl font-semibold">Seu usuario esta inativo no FROTAS.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          A conta Microsoft foi autenticada, mas o acesso ao sistema precisa ser liberado por um
          administrador.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/login">Voltar ao login</Link>
        </Button>
      </section>
    </main>
  );
}
