// Outlook (motor Word) renderiza mal imagens embutidas via cid/attachment — usamos URL publica hospedada.
// Hospedada no Supabase Storage (bucket "email-assets", publico) em vez do dominio *.azurewebsites.net:
// o filtro anti-phishing do Microsoft 365 (Defender/Safe Links) bloqueia silenciosamente imagens
// vindas de dominios genericos de PaaS (azurewebsites.net, herokuapp.com, etc.).
export const EMAIL_LOGO_URL =
  "https://nwoqastjgkgsifmxdqwp.supabase.co/storage/v1/object/public/email-assets/bemol-manutencao-logo-email.png";
