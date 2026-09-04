import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { OnlineStatus } from "@/components/online-status";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const erro = (await searchParams).erro;

  return (
    <main className="login-stage">
      <style nonce={nonce}>{`
        * { box-sizing: border-box; }

        .login-stage {
          width: 100vw;
          height: 100vh;
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          font-family: Inter, system-ui, sans-serif;
          background: #06091a;
          color: #f8fafc;
        }

        /* ── Lado esquerdo: foto ── */
        .login-photo {
          position: relative;
          overflow: hidden;
        }

        .login-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          /* Centraliza no caminhão — foco na cabine + baú com logo Bemol */
          object-position: 55% 50%;
          display: block;
        }

        /* Fade lateral fino — só os últimos 22% somem, o caminhão fica totalmente visível */
        .login-photo::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(to right,
            transparent  0%,
            transparent 62%,
            rgba(6,9,26,.04) 70%,
            rgba(6,9,26,.22) 78%,
            rgba(6,9,26,.60) 86%,
            rgba(6,9,26,.90) 93%,
            #06091a 100%
          );
          pointer-events: none;
        }

        /* Overlay escuro muito leve no topo/base para o badge e texto ficarem legíveis */
        .login-photo-badge {
          position: absolute;
          top: 28px;
          left: 28px;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(6, 9, 26, .55);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 12px;
          padding: 8px 14px;
        }

        .login-photo-badge span {
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
        }

        .login-photo-badge .sep {
          width: 1px;
          height: 16px;
          background: rgba(255,255,255,.2);
        }

        .login-photo-badge .sub {
          font-size: 14px;
          font-weight: 600;
          color: #b4bbd3;
        }

        /* ── Lado direito: card de login ── */
        .login-right {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 48px 40px;
          background: #06091a;
        }

        .login-card {
          width: min(360px, 100%);
          background: rgba(13, 18, 38, .9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          padding: 36px 32px;
          box-shadow: 0 30px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.05);
        }

        .login-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(31,224,161,.1);
          color: #1fe0a1;
          border: 1px solid rgba(31,224,161,.22);
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .login-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #1fe0a1;
          box-shadow: 0 0 8px #1fe0a1;
        }

        .login-badge[data-status="checking"] {
          color: #cbd5e1;
          background: rgba(203,213,225,.08);
          border-color: rgba(203,213,225,.18);
        }
        .login-badge[data-status="checking"] .login-badge-dot {
          background: #94a3b8;
          box-shadow: 0 0 8px #94a3b8;
        }
        .login-badge[data-status="offline"],
        .login-badge[data-status="unavailable"] {
          color: #fbbf24;
          background: rgba(251,191,36,.08);
          border-color: rgba(251,191,36,.22);
        }
        .login-badge[data-status="offline"] .login-badge-dot,
        .login-badge[data-status="unavailable"] .login-badge-dot {
          background: #fbbf24;
          box-shadow: 0 0 8px #fbbf24;
        }

        .login-card h1 {
          margin: 18px 0 4px;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -.01em;
          color: #f8fafc;
        }

        .login-card p {
          margin: 0 0 24px;
          font-size: 13px;
          color: #b4bbd3;
          line-height: 1.5;
        }

        .login-ms-btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          background: #1f6feb;
          color: #fff;
          border: none;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: transform .15s, background .15s, box-shadow .15s;
          box-shadow: 0 8px 20px rgba(31,111,235,.35), inset 0 1px 0 rgba(255,255,255,.18);
        }

        .login-ms-btn:hover {
          transform: translateY(-1px);
          background: #2d7fff;
          box-shadow: 0 12px 28px rgba(31,111,235,.45);
        }

        .login-ms-btn:focus-visible {
          outline: 2px solid #ffd23f;
          outline-offset: 3px;
        }

        .login-ms-tile {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          width: 16px;
          height: 16px;
        }

        .login-ms-tile span { display: block; }
        .login-ms-tile span:nth-child(1) { background: #f25022; }
        .login-ms-tile span:nth-child(2) { background: #7fba00; }
        .login-ms-tile span:nth-child(3) { background: #00a4ef; }
        .login-ms-tile span:nth-child(4) { background: #ffb900; }

        .login-footnote {
          margin: 16px 0 0;
          font-size: 11px;
          color: #6b7494;
          text-align: center;
        }

        .login-footnote b {
          color: #b4bbd3;
          font-weight: 600;
        }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 20px 0;
          font-size: 11px;
          color: #6b7494;
          text-transform: uppercase;
          letter-spacing: .06em;
        }

        .login-divider::before,
        .login-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,.1);
        }

        .login-terceiro-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .login-terceiro-form label {
          font-size: 12px;
          color: #b4bbd3;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .login-terceiro-form input {
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 8px;
          padding: 10px 12px;
          color: #f8fafc;
          font-size: 14px;
        }

        .login-terceiro-form input:focus-visible {
          outline: 2px solid #ffd23f;
          outline-offset: 1px;
        }

        .login-terceiro-btn {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          background: transparent;
          color: #f8fafc;
          border: 1px solid rgba(255,255,255,.18);
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: background .15s, border-color .15s;
        }

        .login-terceiro-btn:hover {
          background: rgba(255,255,255,.06);
          border-color: rgba(255,255,255,.3);
        }

        .login-erro {
          margin: 0 0 16px;
          padding: 10px 12px;
          border-radius: 8px;
          background: rgba(239,68,68,.12);
          border: 1px solid rgba(239,68,68,.3);
          color: #fca5a5;
          font-size: 12px;
        }

        @media (max-width: 1023px) {
          .login-stage {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr;
            align-items: center;
            justify-items: center;
          }

          .login-photo { display: none; }

          .login-right {
            width: 100%;
            min-height: 100vh;
            padding: 40px 20px;
          }
        }
      `}</style>

      {/* Lado esquerdo — foto */}
      <div className="login-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/bemol-truck.jpg" alt="Caminhão Bemol" />

        {/* Badge no canto */}
        <div className="login-photo-badge">
          <Image
            src="/assets/login-logo.png"
            alt=""
            width={24}
            height={24}
            className="object-contain"
          />
          <span>Manutenção</span>
          <span className="sep" />
          <span className="sub">Frotas</span>
        </div>
      </div>

      {/* Lado direito — card */}
      <div className="login-right">
        <div className="login-card">
          <OnlineStatus variant="login" />
          <h1>Frotas Bemol</h1>
          <p>Entre com sua conta corporativa para acessar o painel.</p>

          {erro && <div className="login-erro" role="alert">{erro}</div>}

          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo: "/" });
            }}
          >
            <button className="login-ms-btn" type="submit">
              <span className="login-ms-tile" aria-hidden="true">
                <span /><span /><span /><span />
              </span>
              Entrar com Microsoft
            </button>
          </form>

          <div className="login-footnote">
            Acesso restrito a contas <b>@bemol.com.br</b>
          </div>

          <div className="login-divider">ou motorista terceiro</div>

          <form
            className="login-terceiro-form"
            action={async (formData: FormData) => {
              "use server";
              try {
                await signIn("motorista-terceiro", {
                  email: String(formData.get("email") ?? ""),
                  senha: String(formData.get("senha") ?? ""),
                  redirectTo: "/motorista",
                });
              } catch (error) {
                if (error instanceof AuthError) {
                  redirect(`/login?erro=${encodeURIComponent("E-mail ou senha inválidos.")}`);
                }
                throw error;
              }
            }}
          >
            <label>
              E-mail
              <input type="email" name="email" autoComplete="email" required placeholder="seuemail@exemplo.com" />
            </label>
            <label>
              Senha
              <input type="password" name="senha" autoComplete="current-password" required />
            </label>
            <button className="login-terceiro-btn" type="submit">
              Entrar como motorista terceiro
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
