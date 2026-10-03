/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    images: {
        unoptimized: true,
    },
    reactStrictMode: true,
    // NOTE (Next 16): the top-level `eslint` key is no longer supported —
    // linting is driven directly by the ESLint CLI (see eslint.config.mjs
    // and the `lint` script in package.json).
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
    webpack: (config, { isServer }) => {        // FIX: pshenmic-dpp's `node` export condition resolves to
        // dist/src/native.js, whose dist/binaries/node.cjs does a runtime
        // require() of native `.node` binaries that webpack cannot parse.
        // Route the package to its WASM entry (the same one the `browser`
        // condition uses), which bundles cleanly in every compilation.
        config.resolve = config.resolve || {}
        config.resolve.alias = {
            ...config.resolve.alias,
            'pshenmic-dpp': 'pshenmic-dpp/wasm',
        }

        // FIX: @dashevo/dashcore-lib (minimal L1 support, lib/core-chain.ts)
        // expects the Node `Buffer` global. Webpack 5 does not polyfill it,
        // so inject the `buffer` package.
        const webpack = require('webpack')
        config.plugins = config.plugins || []
        config.plugins.push(new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }))

        // Optimize Dash SDK bundle size
        if (!isServer) {
            // FIX: the WASM entry guards these Node builtins behind `isNode`,
            // but webpack still statically resolves them for the client. Map
            // them to empty modules so the browser bundle compiles.
            config.resolve.fallback = {
                ...config.resolve.fallback,
                worker_threads: false,
                // @dashevo/bls (transitive via dashcore-lib, used only for
                // BLS signatures we never touch) is an Emscripten build whose
                // node branch requires fs/path/crypto. In the browser that
                // branch is dead code, so resolve them to empty modules.
                fs: false,
                path: false,
                crypto: false,
            }

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
}

module.exports = nextConfig
