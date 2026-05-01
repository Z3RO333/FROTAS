import { Building2, LogIn } from "lucide-react";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted px-4">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-2xl">Frotas Bemol</CardTitle>
            <CardDescription>Entre com sua conta corporativa.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo: "/" });
            }}
          >
            <Button type="submit" className="w-full gap-2">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Entrar com Microsoft
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">
            Acesso restrito a contas <strong>@bemol.com.br</strong>.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
