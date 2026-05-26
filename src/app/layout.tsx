import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '强势板块复盘',
    template: '%s | 强势板块复盘',
  },
  description:
    '基于每日涨停个股行情，精准捕捉市场主线与资金流向，助力投资决策。',
  keywords: [
    '板块复盘',
    '涨停分析',
    '股票行情',
    '资金流向',
    '市场主线',
    '投资决策',
  ],
  authors: [{ name: '强势板块复盘' }],
  generator: 'Next.js',
  openGraph: {
    title: '强势板块复盘',
    description:
      '基于每日涨停个股行情，精准捕捉市场主线与资金流向，助力投资决策。',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="en">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
