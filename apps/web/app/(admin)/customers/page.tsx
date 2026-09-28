import Link from "next/link";
import { getCustomers } from "@/lib/api";
import { CreateCustomerButton } from "./create-customer-button";

export default async function CustomersPage() {
  const customers = await getCustomers();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <CreateCustomerButton apiUrl={apiUrl} />
      </div>
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
                <Link href={`/customers/${customer.id}`} className="underline">
                  {customer.firstName} {customer.lastName}
                </Link>
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
