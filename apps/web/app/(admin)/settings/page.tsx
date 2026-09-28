import { getAuditLogs, getNotificationTemplates, getSettings } from "@/lib/api";
import { BusinessInfoForm } from "./business-info-form";
import { EmailSettingsForm } from "./email-settings-form";
import { NtfySettingsForm } from "./ntfy-settings-form";
import { TemplateButton } from "./template-button";

export default async function SettingsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [settings, logs, templates] = await Promise.all([
    getSettings(),
    getAuditLogs(),
    getNotificationTemplates(),
  ]);

  return (
    <main className="flex flex-col gap-10 p-8">
      <h1 className="text-2xl font-semibold">Paramètres</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Informations</h2>
        <BusinessInfoForm settings={settings} apiUrl={apiUrl} />
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Email</h2>
          <span className={`badge ${settings.email.active ? "badge-success" : "badge-warning"}`}>
            {settings.email.active ? settings.email.provider : "non actif"}
          </span>
        </div>
        <EmailSettingsForm settings={settings} apiUrl={apiUrl} />
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Alertes admin (ntfy)</h2>
          <span className={`badge ${settings.ntfy.configured ? "badge-success" : "badge-default"}`}>
            {settings.ntfy.configured ? "configuré" : "non configuré"}
          </span>
        </div>
        <NtfySettingsForm settings={settings} apiUrl={apiUrl} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Templates de notification</h2>
        <p className="mb-3 text-xs opacity-70">
          Cliquer sur un template pour en modifier le sujet et le contenu.
        </p>
        <div className="flex flex-wrap gap-2">
          {templates.map((template) => (
            <TemplateButton key={template.template} template={template} apiUrl={apiUrl} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Journal d'audit</h2>
        {logs.length === 0 ? (
          <div className="card card-body text-center text-sm opacity-60">
            Aucune action enregistrée
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Entité</th>
                  <th>Par</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString("fr-FR")}</td>
                    <td>{log.action}</td>
                    <td>
                      {log.entityType} #{log.entityId.slice(0, 8)}
                    </td>
                    <td>
                      {log.user.firstName} {log.user.lastName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
