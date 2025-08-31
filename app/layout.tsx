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
    description: 'An unstoppable social community for the fearless and the brave.',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="h-full">
            <body className={`${inter.className} h-full bg-white dark:bg-black`}>
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
            <Script src="https://scripts.simpleanalyticscdn.com/latest.js" />
        </html>
    )
}
