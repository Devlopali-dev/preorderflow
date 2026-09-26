import { getCustomers } from "@/lib/api";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Clients</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Nom</th>
            <th className="py-2">Email</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id} className="border-b">
              <td className="py-2">
                {customer.firstName} {customer.lastName}
              </td>
              <td className="py-2">{customer.email}</td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr>
              <td colSpan={2} className="py-4 text-center opacity-60">
                Aucun client
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
