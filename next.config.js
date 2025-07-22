/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['images.unsplash.com', 'api.dicebear.com'],
  },
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
              "connect-src 'self' https: wss: https://44.240.98.102:1443",
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
          }
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