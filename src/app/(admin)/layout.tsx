import Link from "next/link";
import { Brand } from "@/components/brand";
import { SignOut } from "@/components/sign-out";
import { requireMembership } from "@/server/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, organization } = await requireMembership();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <Link href="/campaigns"><Brand small /></Link>
            <span className="text-sm text-muted">{organization.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted sm:inline">{user.email}</span>
            <SignOut />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
