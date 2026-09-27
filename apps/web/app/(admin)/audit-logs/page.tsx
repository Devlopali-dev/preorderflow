import { getAuditLogs } from "@/lib/api";

export default async function AuditLogsPage() {
  const logs = await getAuditLogs();

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Journal d'audit</h1>
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
    </main>
  );
}
