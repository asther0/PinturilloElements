import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PinturilloElements",
  description: "Juego de dibujo estilo Skribbl con temas tech",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-zinc-900 text-white antialiased">{children}</body>
    </html>
  );
}
