import type { Metadata } from "next";
import { Space_Mono, DM_Sans } from "next/font/google";
import { UiSoundFeedback } from "@/components/UiSoundFeedback";
import "./globals.css";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

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
      <body
        className={`${spaceMono.variable} ${dmSans.variable} bg-[#E7E2D4] text-[#111111] antialiased`}
      >
        <UiSoundFeedback />
        {children}
      </body>
    </html>
  );
}
