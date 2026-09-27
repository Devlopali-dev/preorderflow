import { getAuditLogs, getSettings } from "@/lib/api";

export default async function SettingsPage() {
  const [settings, logs] = await Promise.all([getSettings(), getAuditLogs()]);

  return (
    <main className="flex flex-col gap-10 p-8">
      <h1 className="text-2xl font-semibold">Paramètres</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Email</h2>
        <div className="card card-body flex flex-col gap-2 text-sm">
          <p>
            Canal actif :{" "}
            <span className={`badge ${settings.email.active ? "badge-success" : "badge-warning"}`}>
              {settings.email.provider ?? "aucun (console)"}
            </span>
          </p>
          <p className="opacity-70">Expéditeur : {settings.email.from ?? "—"}</p>
          <p className="opacity-70">
            Resend : {settings.email.resendConfigured ? "configuré" : "non configuré"} · SMTP :{" "}
            {settings.email.smtpConfigured ? "configuré" : "non configuré"}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Alertes admin (ntfy)</h2>
        <div className="card card-body text-sm">
          <span className={`badge ${settings.ntfy.configured ? "badge-success" : "badge-default"}`}>
            {settings.ntfy.configured ? "configuré" : "non configuré"}
          </span>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Templates de notification</h2>
        <div className="flex flex-wrap gap-2">
          {settings.templates.map((template) => (
            <span key={template} className="badge badge-default">
              {template}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Journal d'audit</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Date</th>
              <th className="py-2">Action</th>
              <th className="py-2">Entité</th>
              <th className="py-2">Par</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b">
                <td className="py-2">{new Date(log.createdAt).toLocaleString("fr-FR")}</td>
                <td className="py-2">{log.action}</td>
                <td className="py-2">
                  {log.entityType} #{log.entityId.slice(0, 8)}
                </td>
                <td className="py-2">
                  {log.user.firstName} {log.user.lastName}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center opacity-60">
                  Aucune action enregistrée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
