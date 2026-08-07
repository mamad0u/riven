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

export const metadata: Metadata = {
  title: "Riven",
  description: "Gestion de prompts modulaires",
};

const themeBootScript = `
(function(){
  try {
    var t = localStorage.getItem('riven-theme');
    var theme = t === 'light' ? 'light' : 'dark';
    var root = document.documentElement;
    root.classList.remove('dark','light');
    root.classList.add(theme);
    root.dataset.theme = theme;
  } catch (e) {}
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-riven-main text-riven-text-primary`}
      >
        {children}
      </body>
    </html>
  );
}
