/* Import (core) modules. */
import type { Metadata } from 'next'
import type { Viewport } from 'next'

import Script from 'next/script'
// import { Inter } from 'next/font/google'

/* Import styles. */
import './globals.css'

/* Import (3rd-party) modules. */
import { Toaster } from 'react-hot-toast'

/* Import (local) modules. */
import { Providers } from '@/components/providers'
import ErrorBoundary from '@/components/error-boundary'
import { Header } from '@/components/ui/header'
import { Footer } from '@/components/ui/footer'

// const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    // themeColor: 'black',
}

export const metadata: Metadata = {
    metadataBase: new URL('https://evonext.app'), // FIXME Handle Testnet
    title: 'EvoNext: Fearless Social Media',
    applicationName: 'EvoNext: Fearless Social Media',
    description: 'Free Your Inhibitions — Discover safe and enjoyable spaces to Explore. Curate. Share YOUR Truth Fearlessly!',
    icons: {
        icon: '/favicon.ico',
    },
    keywords: ['dash', 'evolution', 'platform', 'social', 'media', 'network'],
    authors: [
        {
            name: 'Sansbank DAO',
            url: 'https://sansbank.org',
        }
    ],
    creator: '0xShomari + Frens',
    publisher: 'Sansbank DAO',
    openGraph: {
        title: 'EvoNext: Fearless Social Media',
        description: 'Free Your Inhibitions — Discover safe and enjoyable spaces to Explore. Curate. Share YOUR Truth Fearlessly!',
        images: [
            {
                url: 'https://evonext.app/poster.webp',
                width: 800,
                height: 600,
                alt: 'EvoNext media banner',
            }
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'EvoNext: Fearless Social Media',
        description: 'Free Your Inhibitions — Discover safe and enjoyable spaces to Explore. Curate. Share YOUR Truth Fearlessly!',
        images: [
            {
                url: 'https://evonext.app/poster.webp',
                width: 800,
                height: 600,
                alt: 'EvoNext media banner',
            }
        ],
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="w-screen h-screen overflow-x-hidden overflow-y-hidden">
            {/* <body className={`${inter.className} w-screen h-screen overflow-x-hidden`}> */}
            <body className={`w-screen h-screen overflow-x-hidden overflow-y-hidden`}>
                <ErrorBoundary level="app">
                    <Providers>
                        <Header />

                        <ErrorBoundary level="page">
                            {children}
                        </ErrorBoundary>

                        <Footer />
                    </Providers>
                </ErrorBoundary>

                <Toaster
                    position="bottom-center"
                    toastOptions={{
                        duration: 3000,
                        style: {
                            background: '#1f2937',
                            color: '#fff',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            fontSize: '14px',
                        },
                    }}
                />
            </body>
            <Script src="/js/latest.js" strategy="afterInteractive" />
        </html>
    )
}
