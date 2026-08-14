import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Grok Engine",
    template: "%s · Grok Engine",
  },
  description: "Search the web with Grok Engine — results, knowledge, news, and AI overviews.",
  applicationName: "Grok Engine",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrument.variable} h-full antialiased`}
    >
      <head>
        <link rel="search" type="application/opensearchdescription+xml" title="Grok Engine" href="/opensearch.xml" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('ge-theme')==='light')document.documentElement.classList.add('light')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">
        <div className="grain" aria-hidden />
        {children}
      </body>
    </html>
  );
}
