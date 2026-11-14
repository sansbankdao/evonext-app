/*
 * lib/dapi-seeds.ts — DAPI seed hosts for the direct grpc-web transport
 * (lib/direct-grpc.ts). Same seed lists the pshenmic dash-platform-sdk's
 * connection pool uses (src/grpcConnectionPool.js, verified 2026-11-15).
 * The app's own wasm transport has its own discovery; these are only for the
 * direct path, which needs a host URL by construction.
 */

export const DAPI_SEED_HOSTS: Record<'mainnet' | 'testnet', string[]> = {
    testnet: [
        'https://68.67.122.1:1443',
        'https://68.67.122.2:1443',
        'https://68.67.122.3:1443',
        'https://68.67.122.4:1443',
        'https://68.67.122.5:1443',
        'https://68.67.122.6:1443',
        'https://68.67.122.7:1443',
        'https://68.67.122.8:1443',
        'https://68.67.122.9:1443',
        'https://68.67.122.10:1443',
        'https://68.67.122.11:1443',
        'https://68.67.122.12:1443',
        'https://68.67.122.13:1443',
        'https://68.67.122.14:1443',
        'https://68.67.122.15:1443',
        'https://153.80.206.232:1443',
        'https://34.209.12.72:1443',
    ],
    mainnet: [
        'https://153.80.206.97:443',
        'https://34.211.174.194:443',
        'https://95.216.146.18:443',
    ],
}
