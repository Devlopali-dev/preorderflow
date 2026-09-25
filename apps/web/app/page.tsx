import { Button } from "@preorderflow/ui";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">PreOrderFlow</h1>
      <p className="text-center text-sm opacity-70">
        Infrastructure prête. Les pages de campagne, recensement et administration arrivent en phase
        3.
      </p>
      <Button variant="primary" onClick={() => {}}>
        Voir les campagnes
      </Button>
    </main>
  );
}
