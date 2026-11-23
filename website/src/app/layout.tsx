import type { Metadata } from 'next';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/pixelify-sans';
import './globals.css';
import { MotionPreferences } from '@/components/motion-preferences';

export const metadata: Metadata = {
  title: 'Bondex Buddy | A pixel pet for your desktop',
  description:
    'Meet Ember fox, Moon cat, and Moss bunny. Tiny pixel companions for a cozier desktop, with focus time, gentle breaks, and a little company.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        <noscript>
          <style>{`[data-reveal] { opacity: 1 !important; transform: none !important; }`}</style>
        </noscript>
        <MotionPreferences>{children}</MotionPreferences>
      </body>
    </html>
  );
}
