import { Plus_Jakarta_Sans, DM_Sans } from 'next/font/google';
import './globals.css';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm',
  display: 'swap',
});

const OG_URL = 'https://visibility.astral3.io';
const OG_IMAGE = `${OG_URL}/og-image.png`;

export const metadata = {
  title: 'AI Visibility Checker — Is Your Web3 Project Visible to AI?',
  description:
    'Check if ChatGPT, Claude, Perplexity and Gemini mention your project. Get a free LLMO audit in 30 seconds.',
  metadataBase: new URL(OG_URL),
  openGraph: {
    title: 'AI Visibility Checker — Is Your Web3 Project Visible to AI?',
    description:
      'Check if ChatGPT, Claude, Perplexity and Gemini mention your project. Free LLMO audit in 30 seconds.',
    type: 'website',
    url: OG_URL,
    siteName: 'Astral — LLMO Intelligence',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'AI Visibility Checker by Astral' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Visibility Checker — Is Your Web3 Project Visible to AI?',
    description: 'Check if ChatGPT, Claude, Perplexity and Gemini mention your project. Free audit in 30 seconds.',
    images: [OG_IMAGE],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${jakartaSans.variable} ${dmSans.variable}`}>
        {children}
      </body>
    </html>
  );
}
