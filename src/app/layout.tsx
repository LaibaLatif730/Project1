import type { Metadata } from 'next'
import './globals.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'AI Clinic Assistant - Smart Aesthetic Aftercare',
  description: 'AI-powered clinic assistant for aesthetic treatment aftercare. Automate check-ins, track recovery, and deliver exceptional patient outcomes.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
