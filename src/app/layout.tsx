import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Barbearia - Agendamento Online",
  description: "Agende seu corte e barba em poucos passos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark h-full antialiased">
      <body className={`${inter.className} min-h-full bg-neutral-950 text-neutral-100 selection:bg-amber-500 selection:text-black`}>
        {children}
      </body>
    </html>
  );
}
