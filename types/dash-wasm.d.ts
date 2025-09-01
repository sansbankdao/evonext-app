// Type declarations for the Dash WASM SDK
declare module '@/lib/dash-wasm/wasm_sdk' {
    export * from '@/lib/dash-wasm/wasm_sdk.d.ts'

    const initWasm: (wasmPath?: string) => Promise<any>
    export default initWasm
}
