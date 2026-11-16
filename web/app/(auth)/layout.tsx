import { redirect } from "next/navigation";
import { AuthExperience } from "@/components/auth/auth-experience";
import { getSessionUser, homePathFor } from "@/lib/auth/session";
import "./auth.css";

/** Login and signup share one persistent layout so switching can animate. */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (user) redirect(homePathFor(user.role));
  return (
    <>
      <AuthExperience />
      {children}
    </>
  );
}
