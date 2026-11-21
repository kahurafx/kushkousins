import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { BagDrawer } from "@/components/bag-drawer";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "kushkousins",
  description: "New and one-of-a-kind upcycled clothing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-canvas text-forest font-sans">
        <Providers>
          <SiteHeader />
          {children}
          <BagDrawer />
        </Providers>
      </body>
    </html>
  );
}
