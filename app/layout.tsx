import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "小红书采集工具",
  description: "将小红书内容一键写入飞书多维表格",
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
