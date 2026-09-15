import type { Metadata } from "next";
import { VT323 } from "next/font/google";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  variable: "--font-vt323",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hermes GO — OS",
  description: "Manage inbox overload with retro style.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${vt323.variable}`}>
      <body>
        <div className="desktop-background">
          <div className="desktop-icon" style={{top: '30px', left: '30px'}}>
            <div className="icon-img my-computer"></div>
            <span>My PC</span>
          </div>
          <div className="desktop-icon" style={{top: '120px', left: '30px'}}>
            <div className="icon-img recycle-bin"></div>
            <span>Trash</span>
          </div>
          <div className="desktop-icon" style={{bottom: '30px', right: '30px'}}>
            <div className="icon-img network"></div>
            <span>Network</span>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
