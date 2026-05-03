import Image from "next/image";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="login-stage">
      <style>
        {`
          .login-stage {
            --bemol-blue: #1f6feb;
            --bemol-blue-deep: #0b3f8e;
            --bemol-yellow: #ffd23f;
            --bemol-red: #ff5147;
            --bemol-green: #1fe0a1;
            --text-1: #f8fafc;
            --text-2: #b4bbd3;
            --text-3: #6b7494;
            width: 100vw;
            height: 100vh;
            min-height: 720px;
            position: relative;
            overflow: hidden;
            background:
              radial-gradient(ellipse 80% 50% at 50% 100%, rgba(31,111,235,.4) 0%, transparent 60%),
              linear-gradient(180deg, #06091a 0%, #0b1230 50%, #1b2340 100%);
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            align-items: center;
            color: var(--text-1);
            font-family: Inter, system-ui, sans-serif;
          }

          .login-stage * {
            box-sizing: border-box;
          }

          .login-stage::before {
            content: "";
            position: absolute;
            inset: 0;
            background-image:
              radial-gradient(1px 1px at 8% 18%, #fff 99%, transparent),
              radial-gradient(1px 1px at 18% 8%, #fff 99%, transparent),
              radial-gradient(1.5px 1.5px at 28% 14%, #fff 99%, transparent),
              radial-gradient(1px 1px at 38% 22%, rgba(255,255,255,.7) 99%, transparent),
              radial-gradient(1px 1px at 48% 6%, #fff 99%, transparent),
              radial-gradient(1.5px 1.5px at 12% 28%, rgba(255,255,255,.6) 99%, transparent),
              radial-gradient(1px 1px at 22% 32%, #fff 99%, transparent),
              radial-gradient(1px 1px at 32% 4%, #fff 99%, transparent),
              radial-gradient(1px 1px at 6% 6%, #fff 99%, transparent),
              radial-gradient(2px 2px at 42% 16%, var(--bemol-yellow) 99%, transparent);
            opacity: .85;
            animation: loginTwinkle 4s ease-in-out infinite;
          }

          @keyframes loginTwinkle {
            0%, 100% { opacity: .9; }
            50% { opacity: .55; }
          }

          .login-top-bar {
            position: absolute;
            top: 28px;
            left: 60px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 4;
          }

          .login-mark {
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            filter: drop-shadow(0 5px 14px rgba(31,111,235,.42));
          }

          .login-logo-img {
            width: 42px;
            height: 42px;
            display: block;
            object-fit: contain;
          }

          .login-brand-name {
            font-weight: 700;
            font-size: 15px;
          }

          .login-sep {
            width: 1px;
            height: 18px;
            background: rgba(255,255,255,.18);
          }

          .login-product {
            font-size: 15px;
            font-weight: 700;
            color: var(--text-2);
          }

          .login-scene {
            position: relative;
            height: 100%;
            overflow: hidden;
          }

          .login-moon {
            position: absolute;
            top: 12%;
            right: 22%;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: radial-gradient(circle at 35% 35%, #ffefc4 0%, #f6d673 70%, #b89a3d 100%);
            box-shadow: 0 0 80px rgba(255, 210, 63, .3);
          }

          .login-mountains {
            position: absolute;
            bottom: 30%;
            left: -5%;
            right: -5%;
            height: 160px;
            pointer-events: none;
          }

          .login-mountains svg {
            width: 100%;
            height: 100%;
            display: block;
          }

          .login-road {
            position: absolute;
            bottom: 0;
            left: -10%;
            right: -10%;
            height: 30%;
            background: linear-gradient(180deg, #0e1530 0%, #060914 100%);
            border-top: 1px solid rgba(31,111,235,.3);
            box-shadow: 0 -20px 50px rgba(31,111,235,.2);
          }

          .login-lane {
            position: absolute;
            bottom: 14%;
            left: 0;
            right: 0;
            height: 5px;
            background: repeating-linear-gradient(90deg, var(--bemol-yellow) 0 36px, transparent 36px 72px);
            opacity: .75;
            animation: loginLaneMove 1.2s linear infinite;
          }

          @keyframes loginLaneMove {
            0% { background-position-x: 0; }
            100% { background-position-x: 72px; }
          }

          .login-road-shoulder {
            position: absolute;
            bottom: 28%;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(31,111,235,.4), rgba(31,111,235,.4), transparent);
          }

          .login-truck-wrap {
            position: absolute;
            bottom: 16%;
            left: 50%;
            width: 420px;
            transform: translateX(-50%);
            animation: loginBob 2.4s ease-in-out infinite;
            z-index: 2;
          }

          @keyframes loginBob {
            0%, 100% { transform: translateX(-50%) translateY(0); }
            50% { transform: translateX(-50%) translateY(-3px); }
          }

          .login-truck-wrap svg {
            width: 100%;
            display: block;
            filter: drop-shadow(0 18px 24px rgba(0,0,0,.55)) drop-shadow(0 4px 8px rgba(0,0,0,.4));
          }

          .login-beam {
            position: absolute;
            top: 58%;
            left: -6%;
            width: 36%;
            height: 22%;
            background: radial-gradient(ellipse at right, rgba(255,210,63,.45) 0%, rgba(255,210,63,0) 70%);
            filter: blur(12px);
            z-index: 1;
            animation: loginBeamFlicker 3s ease-in-out infinite;
          }

          .login-beam-2 {
            position: absolute;
            top: 62%;
            left: -2%;
            width: 28%;
            height: 8%;
            background: radial-gradient(ellipse at right, rgba(255,255,255,.35) 0%, transparent 70%);
            filter: blur(6px);
            z-index: 1;
          }

          @keyframes loginBeamFlicker {
            0%, 100% { opacity: 1; }
            50% { opacity: .82; }
          }

          .login-dust {
            position: absolute;
            bottom: 18%;
            right: 38%;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: rgba(180, 187, 211, .5);
            filter: blur(2px);
            animation: loginDustRise 2.4s ease-out infinite;
          }

          .login-dust:nth-of-type(2) {
            right: 36%;
            animation-delay: .8s;
          }

          .login-dust:nth-of-type(3) {
            right: 40%;
            animation-delay: 1.6s;
          }

          @keyframes loginDustRise {
            0% { transform: translate(0, 0) scale(.6); opacity: 0; }
            20% { opacity: .6; }
            100% { transform: translate(40px, -30px) scale(2); opacity: 0; }
          }

          .login-road-glow {
            position: absolute;
            bottom: 12%;
            left: 18%;
            width: 30%;
            height: 80px;
            background: radial-gradient(ellipse, rgba(255,210,63,.18) 0%, transparent 70%);
            filter: blur(12px);
            z-index: 1;
          }

          .login-form-side {
            padding: 60px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            position: relative;
            z-index: 3;
          }

          .login-card {
            background: rgba(13, 18, 38, .72);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 18px;
            padding: 32px;
            width: 380px;
            box-shadow: 0 30px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
            position: relative;
            z-index: 5;
          }

          .login-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(31,224,161,.12);
            color: var(--bemol-green);
            border: 1px solid rgba(31,224,161,.25);
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
            background: var(--bemol-green);
            box-shadow: 0 0 8px var(--bemol-green);
          }

          .login-card h1 {
            margin: 18px 0 4px;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -.01em;
            color: var(--text-1);
          }

          .login-card p {
            margin: 0 0 22px;
            font-size: 13px;
            color: var(--text-2);
          }

          .login-ms-btn {
            width: 100%;
            padding: 14px;
            border-radius: 10px;
            background: var(--bemol-blue);
            color: #fff;
            border: none;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: transform .15s, box-shadow .15s, background .15s;
            box-shadow: 0 8px 20px rgba(31,111,235,.35), inset 0 1px 0 rgba(255,255,255,.18);
          }

          .login-ms-btn:hover {
            transform: translateY(-1px);
            background: #2d7fff;
          }

          .login-ms-btn:focus-visible {
            outline: 2px solid var(--bemol-yellow);
            outline-offset: 3px;
          }

          .login-ms-tile {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2px;
            width: 16px;
            height: 16px;
          }

          .login-ms-tile span {
            display: block;
          }

          .login-ms-tile span:nth-child(1) { background: #f25022; }
          .login-ms-tile span:nth-child(2) { background: #7fba00; }
          .login-ms-tile span:nth-child(3) { background: #00a4ef; }
          .login-ms-tile span:nth-child(4) { background: #ffb900; }

          .login-footnote {
            margin: 16px 0 0;
            font-size: 11px;
            color: var(--text-3);
            text-align: center;
          }

          .login-footnote b {
            color: var(--text-2);
            font-weight: 600;
          }

          @media (max-width: 1023px) {
            .login-stage {
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 96px 20px 40px;
            }

            .login-scene {
              display: none;
            }

            .login-top-bar {
              top: 24px;
              left: 24px;
            }

            .login-form-side {
              width: 100%;
              padding: 0;
              align-items: center;
            }

            .login-card {
              width: min(380px, 100%);
            }
          }
        `}
      </style>

      <div className="login-top-bar">
        <div className="login-mark" aria-hidden="true">
          <Image
            src="/assets/login-logo.png"
            alt=""
            width={42}
            height={42}
            className="login-logo-img"
            priority
          />
        </div>
        <span className="login-brand-name">Manutenção</span>
        <span className="login-sep" />
        <span className="login-product">Frotas</span>
      </div>

      <div className="login-scene" aria-hidden="true">
        <div className="login-moon" />

        <div className="login-mountains">
          <svg viewBox="0 0 1000 160" preserveAspectRatio="none">
            <path
              d="M 0 160 L 0 90 L 100 50 L 200 100 L 320 30 L 440 90 L 560 40 L 680 100 L 820 30 L 940 90 L 1000 50 L 1000 160 Z"
              fill="#0b1230"
              stroke="rgba(31,111,235,.3)"
              strokeWidth="1"
            />
            <path
              d="M 0 160 L 0 120 L 120 100 L 240 120 L 360 90 L 480 120 L 600 100 L 720 125 L 860 100 L 1000 120 L 1000 160 Z"
              fill="#06091a"
            />
          </svg>
        </div>

        <div className="login-road">
          <div className="login-road-shoulder" />
          <div className="login-lane" />
        </div>

        <div className="login-road-glow" />
        <div className="login-beam" />
        <div className="login-beam-2" />

        <div className="login-truck-wrap">
          <TruckIllustration />
        </div>

        <div className="login-dust" />
        <div className="login-dust" />
        <div className="login-dust" />
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <span className="login-badge">
            <span className="login-badge-dot" />
            Sistema online
          </span>
          <h1>Frotas Bemol</h1>
          <p>Entre com sua conta corporativa para acessar o painel.</p>

          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo: "/" });
            }}
          >
            <button className="login-ms-btn" type="submit">
              <span className="login-ms-tile" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </span>
              Entrar com Microsoft
            </button>
          </form>

          <div className="login-footnote">
            Acesso restrito a contas <b>@bemol.com.br</b>
          </div>
        </div>
      </div>
    </main>
  );
}

function TruckIllustration() {
  return (
    <svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="loginTruckBody" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3a82ff" />
          <stop offset="1" stopColor="#1f6feb" />
        </linearGradient>
        <linearGradient id="loginTruckCab" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#4f90ff" />
          <stop offset="1" stopColor="#2563d8" />
        </linearGradient>
        <linearGradient id="loginTruckBeam" x1="1" x2="0" y1="0.5" y2="0.5">
          <stop offset="0" stopColor="#ffd23f" stopOpacity=".7" />
          <stop offset="1" stopColor="#ffd23f" stopOpacity="0" />
        </linearGradient>
        <clipPath id="loginTruckClip">
          <rect x="120" y="38" width="180" height="92" rx="6" />
        </clipPath>
      </defs>
      <ellipse cx="160" cy="148" rx="120" ry="6" fill="rgba(0,0,0,.4)" />
      <rect x="120" y="38" width="180" height="92" rx="6" fill="url(#loginTruckBody)" />
      <rect x="120" y="38" width="180" height="6" fill="rgba(255,255,255,.18)" />
      <rect x="120" y="124" width="180" height="6" fill="rgba(0,0,0,.25)" />
      <g clipPath="url(#loginTruckClip)">
        <g transform="rotate(-22 210 84)">
          <rect x="60" y="68" width="320" height="3" fill="#ffffff" opacity="0.35" />
          <rect x="60" y="78" width="320" height="2" fill="#ffd23f" />
          <rect x="60" y="86" width="320" height="3" fill="#ff5147" />
        </g>
      </g>
      <rect x="184" y="64" width="64" height="28" rx="3" fill="#fff" />
      <text
        x="216"
        y="84"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="900"
        fontSize="14"
        fontStyle="italic"
        fill="#1f6feb"
      >
        bemol
      </text>
      <path d="M 36 130 L 36 78 Q 36 56 56 56 L 110 56 Q 124 56 124 70 L 124 130 Z" fill="url(#loginTruckCab)" />
      <path d="M 50 78 Q 50 66 62 66 L 110 66 Q 116 66 116 72 L 116 96 L 50 96 Z" fill="#a8cfff" />
      <path d="M 50 78 Q 50 66 62 66 L 110 66 Q 116 66 116 72 L 116 96 L 50 96 Z" fill="rgba(255,255,255,.25)" />
      <rect x="30" y="80" width="6" height="14" rx="2" fill="#1b2340" />
      <rect x="36" y="106" width="8" height="10" rx="2" fill="#ffd23f" />
      <rect x="0" y="100" width="36" height="22" fill="url(#loginTruckBeam)" />
      <rect x="32" y="120" width="14" height="10" rx="2" fill="#0e1530" />
      <circle cx="78" cy="132" r="14" fill="#0a0f1f" />
      <circle cx="78" cy="132" r="6" fill="#3a4a6b" />
      <circle cx="220" cy="132" r="14" fill="#0a0f1f" />
      <circle cx="220" cy="132" r="6" fill="#3a4a6b" />
      <circle cx="252" cy="132" r="14" fill="#0a0f1f" />
      <circle cx="252" cy="132" r="6" fill="#3a4a6b" />
    </svg>
  );
}
