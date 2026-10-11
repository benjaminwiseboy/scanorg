import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export default async function Home() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  redirect(session ? "/campaigns" : "/login");
}
