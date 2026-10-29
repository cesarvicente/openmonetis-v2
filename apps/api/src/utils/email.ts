const resendEndpoint = "https://api.resend.com/emails";
const sendTimeoutMs = 10_000;

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSender = {
  enabled: boolean;
  send(message: EmailMessage): Promise<void>;
};

export const emailSender = createEmailSender();

function createEmailSender(): EmailSender {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (Boolean(apiKey) !== Boolean(from)) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM must be configured together");
  }

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY and EMAIL_FROM are required in production");
    }
    return createDevelopmentEmailSender();
  }

  return {
    enabled: true,
    async send(message) {
      const response = await fetch(resendEndpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, ...message, to: [message.to] }),
        signal: AbortSignal.timeout(sendTimeoutMs),
      });
      if (!response.ok) {
        throw new Error(`Resend rejected the email with status ${response.status}`);
      }
    },
  };
}

// Without credentials outside production, print the message so links can be followed locally.
function createDevelopmentEmailSender(): EmailSender {
  return {
    enabled: false,
    async send(message) {
      if (process.env.NODE_ENV === "test") return;
      console.info(`[Email] ${message.subject} -> ${message.to}\n${message.text}`);
    },
  };
}
