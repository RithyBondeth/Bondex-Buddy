import type { Metadata } from 'next';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/pixelify-sans';
import './globals.css';
import { MotionPreferences } from '@/components/motion-preferences';

export const metadata: Metadata = {
  title: 'Bondex Buddy | Pixel companions for your desktop',
  description:
    'Meet ten animated desktop companions. Explore their habitats, try the focus timer, and discover the pocket for tasks, clipboard history, files, and agent handoffs.',
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
