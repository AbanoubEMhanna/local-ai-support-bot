import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local AI Support Bot",
  description: "Local-first support bot powered by Ollama or LM Studio."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

