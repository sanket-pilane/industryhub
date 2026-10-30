import { redirect } from "next/navigation";
import { AuthExperience } from "@/components/auth/auth-experience";
import { getSessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import "./auth.css";

/** Login and signup share one persistent layout so switching can animate. */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await getSessionUser()) redirect("/");
  return (
    <>
      <AuthExperience mockMode={env.NEXT_PUBLIC_DATA_MODE === "mock"} />
      {children}
    </>
  );
}
