"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@preorderflow/ui";
import type { Settings } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

const TOPIC_WORDS = [
  "atelier",
  "colis",
  "renard",
  "chene",
  "brume",
  "corail",
  "lynx",
  "grenat",
  "falaise",
  "orage",
  "tilleul",
  "cedre",
  "loutre",
  "basalte",
  "marais",
  "faucon",
  "argile",
  "ronce",
  "givre",
  "sable",
];

// 2 à 4 mots séparés par des tirets + un nombre — assez unique pour éviter
// une collision sur un serveur ntfy public (le topic sert d'URL, n'importe
// qui le connaissant peut s'y abonner ou y publier).
function generateRandomTopic(): string {
  const wordCount = 2 + Math.floor(Math.random() * 3);
  const words: string[] = Array.from(
    { length: wordCount },
    () => TOPIC_WORDS[Math.floor(Math.random() * TOPIC_WORDS.length)],
  );
  const digits = String(Math.floor(Math.random() * 9000) + 1000);
  // Position aléatoire, pas toujours à la fin — évite un motif "mots-mots-1234"
  // trop prévisible/reconnaissable.
  const insertAt = Math.floor(Math.random() * (words.length + 1));
  words.splice(insertAt, 0, digits);
  return words.join("-");
}

export function NtfySettingsForm({ settings, apiUrl }: { settings: Settings; apiUrl: string }) {
  const router = useRouter();
  const [ntfyUrl, setNtfyUrl] = useState(settings.ntfy.url);
  const [ntfyTopic, setNtfyTopic] = useState(settings.ntfy.topic ?? "");
  const [ntfyAuth, setNtfyAuth] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  function currentValues() {
    return {
      ntfyUrl: ntfyUrl || undefined,
      ntfyTopic: ntfyTopic || undefined,
      ntfyAuth: ntfyAuth || undefined,
    };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${apiUrl}/api/v1/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify(currentValues()),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      setNtfyAuth("");
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/settings/test-ntfy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify(currentValues()),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? `Erreur (${res.status})`);
      setTestResult(body);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="card card-body flex flex-col gap-3 text-sm">
      <p className="text-xs opacity-70">
        ntfy.sh envoie une alerte push (nouvelle commande, paiement reçu...) sur ton téléphone via
        l&apos;app ntfy (gratuite, iOS/Android). Choisis un nom de sujet unique (ex:
        preorderflow-tonpseudo) et abonne-toi au même nom dans l&apos;app.
      </p>
      <label className="flex flex-col gap-1">
        Serveur ntfy
        <Input
          value={ntfyUrl}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setNtfyUrl(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        Sujet (topic)
        <div className="flex gap-2">
          <Input
            className="flex-1"
            value={ntfyTopic}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNtfyTopic(e.target.value)}
          />
          <Button variant="secondary" onClick={() => setNtfyTopic(generateRandomTopic())}>
            Générer
          </Button>
        </div>
      </label>
      <label className="flex flex-col gap-1">
        Authentification (format user:password, optionnel — uniquement pour un serveur ntfy privé)
        <Input
          type="password"
          placeholder={settings.ntfy.configured ? "laisser vide pour ne pas changer" : ""}
          value={ntfyAuth}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setNtfyAuth(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button variant="primary" loading={saving} onClick={handleSave}>
          Enregistrer
        </Button>
        <Button variant="secondary" loading={testing} disabled={!ntfyTopic} onClick={handleTest}>
          Envoyer un test
        </Button>
        {success && <span className="text-green-600">Enregistré</span>}
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {testResult && (
        <p className={testResult.success ? "text-green-600" : "text-red-600"}>
          {testResult.message}
        </p>
      )}
    </div>
  );
}
