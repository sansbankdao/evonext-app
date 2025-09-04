/* Import (core) modules. */
import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'

/* Import styles. */
import './globals.css'

/* Import (3rd-party) modules. */
import { Toaster } from 'react-hot-toast'

/* Import (local) modules. */
import { Providers } from '@/components/providers'
import ErrorBoundary from '@/components/error-boundary'
import { DevelopmentBanner } from '@/components/ui/development-banner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Yappr! Free Your Inner Voice',
    description: 'Discover safe and enjoyable spaces to Explore. Curate. Share YOUR TRUTH without any fear of social consequence.',

    viewport: 'width=device-width, initial-scale=1.0',
    icons: {
        icon: '/favicon.ico',
    },
    keywords: 'dash evolution platform social media network',
    authors: [
        {
            name: 'Sansbank DAO',
            url: 'https://sansbank.org',
        }
    ],
    openGraph: {
        title: 'Yappr! Free Your Inner Voice',
        description: 'Discover safe and enjoyable spaces to Explore. Curate. Share YOUR TRUTH without any fear of social consequence.',
        images: [
            {
                url: '/poster.webp',
                width: 1500,
                height: 500,
                alt: 'Yappr! media banner',
            }
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Yappr! Free Your Inner Voice',
        description: 'Discover safe and enjoyable spaces to Explore. Curate. Share YOUR TRUTH without any fear of social consequence.',
        images: [
            {
                url: '/poster.webp',
                width: 1500,
                height: 500,
                alt: 'Yappr! media banner',
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
        <html lang="en" className="w-screen h-screen">
            <body className={`${inter.className} w-screen h-screen`}>
                <ErrorBoundary level="app">
                    <Providers>
                        <DevelopmentBanner />

                        <ErrorBoundary level="page">
                            {children}
                        </ErrorBoundary>
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
