import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  frota?: string | number | null;
  title?: string;
};

export function BemolTruck({ className, frota, title = "Caminhao Bemol" }: Props) {
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 420 210"
      className={cn("h-auto w-full", className)}
    >
      <defs>
        <linearGradient id="truckBody" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#0b64c0" />
          <stop offset="100%" stopColor="#083a8c" />
        </linearGradient>
        <linearGradient id="truckCabin" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#156fe0" />
          <stop offset="100%" stopColor="#0b4aa2" />
        </linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#0f172a" floodOpacity=".18" />
        </filter>
      </defs>

      <ellipse cx="218" cy="176" rx="162" ry="20" fill="#0f172a" opacity=".12" />

      <g filter="url(#softShadow)">
        <path
          d="M127 55h170c14 0 24 10 24 24v71H91V91c0-20 16-36 36-36Z"
          fill="url(#truckBody)"
        />
        <path d="M91 91h70v59H70v-36c0-13 8-23 21-23Z" fill="url(#truckCabin)" />
        <path d="M101 72h48c12 0 22 10 22 22v56h-80V82c0-6 4-10 10-10Z" fill="#0b4aa2" />
        <path d="M111 82h33c7 0 13 6 13 13v20h-46V82Z" fill="#dbeafe" opacity=".95" />
        <path d="M178 69h126c3 0 5 2 5 5v59H178V69Z" fill="#0b56b3" />
        <path d="M205 69h23l-54 64h-23l54-64Z" fill="#7dd3fc" opacity=".75" />
        <path d="M262 69h18l-54 64h-18l54-64Z" fill="#f43f5e" opacity=".9" />
        <path d="M288 69h16c3 0 5 2 5 5v16l-37 43h-18l34-64Z" fill="#7dd3fc" opacity=".65" />
        <rect x="194" y="91" width="77" height="27" rx="5" fill="#fff" opacity=".96" />
        <text
          x="233"
          y="110"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="18"
          fontWeight="700"
          fill="#0b4aa2"
        >
          BEMOL
        </text>
        <path d="M70 141h255v17c0 6-5 11-11 11H82c-7 0-12-5-12-12v-16Z" fill="#082f69" />
        <rect x="70" y="122" width="22" height="14" rx="3" fill="#facc15" />
        <rect x="306" y="126" width="15" height="18" rx="3" fill="#ef4444" />

        {frota ? (
          <g>
            <rect x="323" y="80" width="52" height="30" rx="8" fill="#fff" />
            <text
              x="349"
              y="100"
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize="13"
              fontWeight="700"
              fill="#0f172a"
            >
              {frota}
            </text>
          </g>
        ) : null}

        <g>
          <circle cx="121" cy="162" r="26" fill="#111827" />
          <circle cx="121" cy="162" r="13" fill="#94a3b8" />
          <circle cx="121" cy="162" r="5" fill="#e2e8f0" />
          <circle cx="267" cy="162" r="26" fill="#111827" />
          <circle cx="267" cy="162" r="13" fill="#94a3b8" />
          <circle cx="267" cy="162" r="5" fill="#e2e8f0" />
        </g>
      </g>
    </svg>
  );
}
