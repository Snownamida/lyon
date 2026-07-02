import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://lyon.snownamida.top";
const siteTitle = "Carte temps réel TCL Lyon — bus, tram, métro";
const siteDescription =
  "Visualisez en temps réel les bus, tramways et métros du réseau TCL de Lyon sur une carte interactive : positions des véhicules, tracés des lignes et ponctualité, à partir des données ouvertes SYTRAL.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  alternates: {
    canonical: siteUrl,
  },
  keywords: [
    "TCL",
    "Lyon",
    "transports en commun",
    "temps réel",
    "bus",
    "tramway",
    "métro",
    "carte interactive",
    "SYTRAL",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Carte temps réel TCL Lyon",
    title: siteTitle,
    description: siteDescription,
    locale: "fr_FR",
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
