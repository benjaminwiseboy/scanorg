import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="eyebrow">Introuvable</p>
      <h1 className="mt-2 font-serif text-2xl">Cette page n'existe pas ou ne vous est pas accessible.</h1>
      <Link href="/" className="btn-ghost mt-8">Retour à l'accueil</Link>
    </main>
  );
}
