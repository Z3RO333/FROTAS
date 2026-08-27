import "server-only";

let configured = false;

export async function getSgMail() {
  const sgMail = await import("@sendgrid/mail");
  const key = process.env.SENDGRID_API_KEY?.trim();
  if (!key) throw new Error("SENDGRID_API_KEY nao configurada.");
  if (!configured) {
    sgMail.default.setApiKey(key);
    configured = true;
  }
  return sgMail.default;
}
