// Notifications push admin (nouvelle commande, paiement reçu, nouvel
// intérêt...) via ntfy.sh (ou une instance self-hostée) — aucune
// dépendance obligatoire : si PREORDERFLOW_NTFY_TOPIC n'est pas configuré,
// no-op.
//
// Préfixe PREORDERFLOW_ volontaire : NTFY_URL/NTFY_TOPIC/NTFY_AUTH sont des
// noms génériques déjà utilisés par d'autres outils sur la machine hôte
// (ex. l'agent qui exécute ce code) — les réutiliser tels quels ferait
// fuiter la config ntfy personnelle de l'opérateur dans l'application.

export interface NtfyMessage {
  title: string;
  message: string;
  tags?: string[];
}

// « user:password » → Basic ; jeton d'accès ntfy (« tk_… », sans « : ») → Bearer.
export function ntfyAuthHeader(auth: string): string {
  const value = auth.trim();
  return value.includes(":") ? `Basic ${Buffer.from(value).toString("base64")}` : `Bearer ${value}`;
}

// Les en-têtes HTTP sont en ASCII : un titre accentué (« Paiement reçu ») ou avec emoji doit
// partir en RFC 2047, que ntfy décode ; sinon fetch peut rejeter l'en-tête ou ntfy afficher du
// charabia.
export function encodeNtfyHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7f]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export function isNtfyConfigured(): boolean {
  return Boolean(process.env.PREORDERFLOW_NTFY_TOPIC);
}

export function buildNtfyUrl(): string {
  const base = (process.env.PREORDERFLOW_NTFY_URL ?? "https://ntfy.sh").replace(/\/+$/, "");
  const topic = process.env.PREORDERFLOW_NTFY_TOPIC;
  if (!topic) {
    throw new Error("PREORDERFLOW_NTFY_TOPIC non configuré");
  }
  return `${base}/${topic}`;
}

export async function sendNtfyNotification({ title, message, tags }: NtfyMessage): Promise<void> {
  if (!isNtfyConfigured()) {
    return;
  }

  const auth = process.env.PREORDERFLOW_NTFY_AUTH; // format "user:password"
  const res = await fetch(buildNtfyUrl(), {
    method: "POST",
    headers: {
      Title: encodeNtfyHeader(title),
      ...(tags && tags.length > 0 ? { Tags: tags.join(",") } : {}),
      ...(auth ? { Authorization: ntfyAuthHeader(auth) } : {}),
    },
    body: message,
  });

  if (!res.ok) {
    throw new Error(`ntfy a répondu ${res.status}`);
  }
}

// Même logique, mais à partir d'une config déjà résolue (base de données +
// fallback .env, cf. SettingsService.getNtfyConfig) — utilisée par
// NotificationService pour qu'un changement depuis /settings prenne effet
// sans redémarrer l'API.
export async function sendNtfyNotificationWithConfig(
  { title, message, tags }: NtfyMessage,
  config: { url: string; topic?: string; auth?: string },
): Promise<void> {
  if (!config.topic) {
    return;
  }

  const base = config.url.replace(/\/+$/, "");
  const res = await fetch(`${base}/${config.topic}`, {
    method: "POST",
    headers: {
      Title: encodeNtfyHeader(title),
      ...(tags && tags.length > 0 ? { Tags: tags.join(",") } : {}),
      ...(config.auth ? { Authorization: ntfyAuthHeader(config.auth) } : {}),
    },
    body: message,
  });

  if (!res.ok) {
    throw new Error(`ntfy a répondu ${res.status}`);
  }
}
