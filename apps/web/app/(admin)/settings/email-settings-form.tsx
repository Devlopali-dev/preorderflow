"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@preorderflow/ui";
import type { Settings } from "@/lib/api";
import { getClientAuthHeaders } from "@/lib/auth";

const PRESETS: Record<string, { host: string; port: number; secure: boolean; helpUrl: string }> = {
  gmail: { host: "smtp.gmail.com", port: 587, secure: false, helpUrl: "https://myaccount.google.com/apppasswords" },
  outlook: {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    helpUrl: "https://account.microsoft.com/security",
  },
};

export function EmailSettingsForm({ settings, apiUrl }: { settings: Settings; apiUrl: string }) {
  const router = useRouter();
  const [provider, setProvider] = useState(settings.email.provider ?? "console");
  const [resendApiKey, setResendApiKey] = useState("");
  const [smtpHost, setSmtpHost] = useState(settings.email.smtpHost ?? "");
  const [smtpPort, setSmtpPort] = useState(String(settings.email.smtpPort ?? 587));
  const [smtpSecure, setSmtpSecure] = useState(settings.email.smtpSecure);
  const [smtpUser, setSmtpUser] = useState(settings.email.smtpUser ?? "");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [emailFrom, setEmailFrom] = useState(settings.email.from ?? "");
  const [helpUrl, setHelpUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function applyPreset(name: keyof typeof PRESETS) {
    const preset = PRESETS[name];
    setProvider("smtp");
    setSmtpHost(preset.host);
    setSmtpPort(String(preset.port));
    setSmtpSecure(preset.secure);
    setHelpUrl(preset.helpUrl);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${apiUrl}/api/v1/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientAuthHeaders() },
        body: JSON.stringify({
          emailProvider: provider,
          resendApiKey: resendApiKey || undefined,
          smtpHost: smtpHost || undefined,
          smtpPort: smtpPort ? Number(smtpPort) : undefined,
          smtpSecure,
          smtpUser: smtpUser || undefined,
          smtpPassword: smtpPassword || undefined,
          emailFrom: emailFrom || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? `Erreur (${res.status})`);
      setResendApiKey("");
      setSmtpPassword("");
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card card-body flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>Se connecter avec :</span>
        <Button variant="secondary" onClick={() => applyPreset("gmail")}>
          Gmail
        </Button>
        <Button variant="secondary" onClick={() => applyPreset("outlook")}>
          Outlook / Hotmail
        </Button>
      </div>

      {helpUrl && (
        <div className="rounded border border-dashed p-3 text-xs opacity-80">
          <p className="mb-1 font-medium">Comment faire :</p>
          <ol className="list-decimal pl-4">
            <li>Active la validation en deux étapes sur ton compte (obligatoire pour créer un mot de passe d&apos;application).</li>
            <li>
              Génère un mot de passe d&apos;application dédié :{" "}
              <a href={helpUrl} target="_blank" rel="noreferrer" className="underline">
                {helpUrl}
              </a>
            </li>
            <li>Colle ton adresse email dans « Utilisateur SMTP » et le mot de passe généré (pas ton mot de passe habituel) dans « Mot de passe SMTP ».</li>
          </ol>
          <p className="mt-1 opacity-70">
            On ne se connecte pas via une vraie authentification Google/Microsoft (OAuth) — ce serait
            disproportionné pour ce projet — mais un mot de passe d&apos;application fait exactement le
            même travail pour envoyer des emails.
          </p>
        </div>
      )}

      <label className="flex flex-col gap-1">
        Provider
        <select className="select" value={provider} onChange={(e: ChangeEvent<HTMLSelectElement>) => setProvider(e.target.value)}>
          <option value="console">Aucun (console, dev uniquement)</option>
          <option value="resend">Resend</option>
          <option value="smtp">SMTP</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        Adresse expéditeur (ex: PreOrderFlow &lt;no-reply@exemple.com&gt;)
        <Input value={emailFrom} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailFrom(e.target.value)} />
      </label>

      {provider === "resend" && (
        <>
          <p className="text-xs opacity-70">
            Crée une clé sur{" "}
            <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="underline">
              resend.com/api-keys
            </a>{" "}
            et colle-la ci-dessous.
          </p>
          <label className="flex flex-col gap-1">
            Clé API Resend {settings.email.resendConfigured && "(déjà configurée — laisser vide pour ne pas changer)"}
            <Input
              type="password"
              placeholder={settings.email.resendConfigured ? "••••••••" : "re_..."}
              value={resendApiKey}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setResendApiKey(e.target.value)}
            />
          </label>
        </>
      )}

      {provider === "smtp" && (
        <>
          <label className="flex flex-col gap-1">
            Hôte SMTP
            <Input value={smtpHost} onChange={(e: ChangeEvent<HTMLInputElement>) => setSmtpHost(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              Port
              <Input value={smtpPort} onChange={(e: ChangeEvent<HTMLInputElement>) => setSmtpPort(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 pt-5">
              <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
              TLS (port 465)
            </label>
          </div>
          <label className="flex flex-col gap-1">
            Utilisateur SMTP
            <Input value={smtpUser} onChange={(e: ChangeEvent<HTMLInputElement>) => setSmtpUser(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            Mot de passe SMTP {settings.email.smtpConfigured && "(déjà configuré — laisser vide pour ne pas changer)"}
            <Input
              type="password"
              placeholder={settings.email.smtpConfigured ? "••••••••" : ""}
              value={smtpPassword}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSmtpPassword(e.target.value)}
            />
          </label>
        </>
      )}

      <div className="flex items-center gap-3">
        <Button variant="primary" loading={saving} onClick={handleSave}>
          Enregistrer
        </Button>
        {success && <span className="text-green-600">Enregistré</span>}
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
