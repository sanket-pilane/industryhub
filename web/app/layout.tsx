import type { Metadata } from "next";
import "@fontsource-variable/inter";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "INDUSTRIHUB — Industrial commerce",
    template: "%s | INDUSTRIHUB",
  },
  description:
    "Source industrial components and manage custom manufacturing, from drawing to delivery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
