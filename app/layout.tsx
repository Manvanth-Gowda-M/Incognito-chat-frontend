import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CloakChat | Anonymous End-to-End Encrypted E2EE Chat",
  description: "Experience total privacy with CloakChat. Zero signups, zero logging, and zero user tracing. End-to-end encrypted room communication directly in the browser via Web Crypto API AES-GCM.",
  keywords: [
    "e2ee",
    "encrypted chat",
    "anonymous chat",
    "privacy-first",
    "zero knowledge",
    "web crypto api",
    "ephemeral chat"
  ],
  authors: [{ name: "CloakChat" }],
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  robots: "index, follow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} dark scroll-smooth h-full`}>
      <body className="min-h-full bg-[#030712] text-gray-100 font-sans antialiased overflow-x-hidden flex flex-col">
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
