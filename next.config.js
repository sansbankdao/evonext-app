/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    images: {
        unoptimized: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    reactStrictMode: true,
    // images: {
    //     // remotePatterns: [ // NOTE: Avail after v15.3.0
    //     //     new URL('https://images.unsplash.com/**'),
    //     //     new URL('https://api.dicebear.com/**'),
    //     // ],
    //     remotePatterns: [
    //         {
    //             protocol: 'https',
    //             hostname: 'images.unsplash.com',
    //             port: '',
    //             pathname: '/**',
    //         },
    //         {
    //             protocol: 'https',
    //             hostname: 'api.dicebear.com',
    //             port: '',
    //             pathname: '/**',
    //         },
    //     ]
    // },
    webpack: (config, { isServer }) => {
        // Optimize Dash SDK bundle size
        if (!isServer) {
            config.optimization = {
                ...config.optimization,
                splitChunks: {
                    chunks: 'all',
                    cacheGroups: {
                        dash: {
                            test: /[\\/]node_modules[\\/]dash[\\/]/,
                            name: 'dash-sdk',
                            priority: 10,
                            reuseExistingChunk: true,
                        },
                    },
                },
            }
        }

        // Handle WASM files
        config.experiments = {
            ...config.experiments,
            asyncWebAssembly: true,
        }

        return config
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' data: https: blob:",
                            "font-src 'self'",
                            "connect-src 'self' https: wss:",
                            "worker-src 'self' blob:",
                            "child-src 'self' blob:"
                        ].join('; ')
                    },
                    // CRITICAL: These headers are required for WASM to work
                    {
                        key: 'Cross-Origin-Embedder-Policy',
                        value: 'require-corp'
                    },
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin'
                    },
                ]
            },
            {
                source: '/dash-wasm/:path*.wasm',
                headers: [
                    {
                        key: 'Content-Type',
                        value: 'application/wasm'
                    },
                    {
                        key: 'Cross-Origin-Embedder-Policy',
                        value: 'require-corp'
                    },
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin'
                    }
                ]
            }
        ]
    }
}

module.exports = nextConfig
