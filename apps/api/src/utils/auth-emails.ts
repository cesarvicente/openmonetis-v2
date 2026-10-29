import type { EmailMessage } from "./email";

type AuthEmailInput = { email: string; name: string; url: string };

export function createVerificationEmail({ email, name, url }: AuthEmailInput): EmailMessage {
  return createActionEmail({
    to: email,
    subject: "Confirme seu e-mail no OpenMonetis",
    greeting: `Olá, ${name}!`,
    body: "Confirme seu e-mail para ativar sua conta no OpenMonetis. O link é válido por 24 horas.",
    action: "Confirmar e-mail",
    url,
    footer: "Se você não criou esta conta, ignore este e-mail.",
  });
}

export function createPasswordResetEmail({ email, name, url }: AuthEmailInput): EmailMessage {
  return createActionEmail({
    to: email,
    subject: "Redefinição de senha do OpenMonetis",
    greeting: `Olá, ${name}!`,
    body: "Recebemos um pedido para redefinir sua senha. O link é válido por 1 hora e só pode ser usado uma vez.",
    action: "Redefinir senha",
    url,
    footer: "Se você não pediu a redefinição, ignore este e-mail. Sua senha atual continua válida.",
  });
}

function createActionEmail(content: {
  to: string;
  subject: string;
  greeting: string;
  body: string;
  action: string;
  url: string;
  footer: string;
}): EmailMessage {
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#191919">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <tr><td>
        <p style="font-size:18px;font-weight:bold;margin:0 0 16px">${escapeHtml(content.greeting)}</p>
        <p style="font-size:15px;line-height:1.5;margin:0 0 24px">${escapeHtml(content.body)}</p>
        <p style="margin:0 0 24px">
          <a href="${escapeHtml(content.url)}" style="display:inline-block;background:#fc941d;color:#191919;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${escapeHtml(content.action)}</a>
        </p>
        <p style="font-size:13px;line-height:1.5;color:#666666;margin:0 0 8px">Se o botão não funcionar, copie este endereço no navegador:</p>
        <p style="font-size:13px;word-break:break-all;margin:0 0 24px"><a href="${escapeHtml(content.url)}" style="color:#666666">${escapeHtml(content.url)}</a></p>
        <p style="font-size:13px;color:#666666;margin:0">${escapeHtml(content.footer)}</p>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = [
    content.greeting,
    "",
    content.body,
    "",
    `${content.action}: ${content.url}`,
    "",
    content.footer,
  ].join("\n");

  return { to: content.to, subject: content.subject, html, text };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
