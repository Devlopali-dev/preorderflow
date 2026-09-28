import { getCustomers } from "@/lib/api";
import { CreateCustomerButton } from "./create-customer-button";
import { CustomerRowButton } from "./customer-row-button";

export default async function CustomersPage() {
  const customers = await getCustomers();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="card-subtitle">
            {customers.length} client{customers.length > 1 ? "s" : ""}
          </p>
        </div>
        <CreateCustomerButton apiUrl={apiUrl} />
      </div>

      {customers.length === 0 ? (
        <div className="card card-body text-center text-sm opacity-60">Aucun client</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <CustomerRowButton
                      customerId={customer.id}
                      label={`${customer.firstName} ${customer.lastName}`}
                      apiUrl={apiUrl}
                    />
                  </td>
                  <td>{customer.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
