export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<{ providerReference?: string }>;
}

// Fallback sans dépendance obligatoire (§32) : si aucune clé API n'est
// configurée, on journalise au lieu d'échouer — utile en dev/démo et pour
// tourner le cœur de l'application sans compte Resend.
export class ConsoleEmailProvider implements EmailProvider {
  async send(to: string, subject: string, html: string) {
    console.log(`[email:console] to=${to} subject="${subject}"\n${html}`);
    return {};
  }
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(to: string, subject: string, html: string) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend a répondu ${res.status}: ${body}`);
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { providerReference: data.id };
  }
}

export function createEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "PreOrderFlow <no-reply@example.com>";
  if (!apiKey) {
    return new ConsoleEmailProvider();
  }
  return new ResendEmailProvider(apiKey, from);
}
