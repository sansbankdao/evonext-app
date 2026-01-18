// app/layout.tsx

/* Import (core) modules. */
import type { Metadata } from 'next'
import type { Viewport } from 'next'

import Script from 'next/script'
// import { Inter } from 'next/font/google'

/* Import styles. */
import './globals.css'

/* Import (3rd-party) modules. */
import { Toaster } from 'react-hot-toast'

/* Imoprt EvoApp window. */
// import AppsPanel from '@/components/apps/panel'

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
    // themeColor: 'black', // FIXME Finalize a theme color
}

export const metadata: Metadata = {
    metadataBase: new URL('https://evonext.app'), // FIXME Handle Testnet as well
    title: 'EvoNext: Free and Fearless Social',
    applicationName: 'EvoNext: Free and Fearless',
    description: 'Connect with early-stage Founders and Creators — plus, the hottest collection of Mini Apps designed to streamline your workflow and simplify everyday tasks.',
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
        title: 'EvoNext: Free and Fearless Social',
        description: 'Connect with early-stage Founders and Creators — plus, the hottest collection of Mini Apps designed to streamline your workflow and simplify everyday tasks.',
        images: [
            {
                url: 'https://evonext.app/poster.webp?1768350110',
                width: 1200,
                height: 630,
                alt: 'EvoNext Open Graph poster',
            }
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'EvoNext: Free and Fearless Social',
        description: 'Connect with early-stage Founders and Creators — plus, the hottest collection of Mini Apps designed to streamline your workflow and simplify everyday tasks.',
        images: [
            {
                url: 'https://evonext.app/poster.webp?1768350110',
                width: 1200,
                height: 630,
                alt: 'EvoNext Open Graph poster',
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

                {/* <AppsPanel /> */}

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
            {/* Simple analytics (local script). */}
            <Script src="/js/latest.js" strategy="afterInteractive" />
        </html>
    )
}
