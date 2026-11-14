/*
 * lib/direct-grpc.ts — minimal grpc-web unary client for
 * org.dash.platform.dapi.v0.Platform/BroadcastStateTransition.
 *
 * WHY: the vendored wasm glue's internal broadcast re-serializes a
 * StateTransition through ITS OWN encoder, which is divergent from consensus
 * for the address-funds witness-carrying types (type 11 IdentityTopUpFromAddresses,
 * type 15 Shield) — proven 2026-11-15 (the glue's wire = the correct bytes shifted
 * right by 4 bits from the inputs' nonce onward). The direct grpc path sends EXACTLY
 * the bytes we build (reference-wire.ts), so drive deserializes the true structure.
 *
 * The wire here is hand-rolled and tiny on purpose (no protobuf-ts dependency):
 *   proto BroadcastStateTransitionRequest { bytes state_transition = 1 }
 *   → [0x0A][varint len][bytes]
 *   grpc-web frame: [0x00][4-byte BE length][message]
 *   response: HTTP 200 with grpc-status/grpc-message headers (errors carry
 *   dash-serialized-consensus-error-bin + drive-error-data-bin metadata).
 */

import { DAPI_SEED_HOSTS } from './dapi-seeds'

export class DirectGrpcError extends Error {
    code: string
    consensusError?: string
    constructor(message: string, code: string, consensusError?: string) {
        super(message)
        this.name = 'DirectGrpcError'
        this.code = code
        this.consensusError = consensusError
    }
}

const writeVarint = (v: number, out: number[]): void => {
    /* protobuf varint (little-endian 7-bit groups, high bit = continue). */
    let x = v >>> 0
    do {
        let byte = x & 0x7f
        x >>>= 7
        if (x !== 0) byte |= 0x80
        out.push(byte)
    } while (x !== 0)
}

const buildFrame = (wire: Uint8Array): Uint8Array => {
    const msg: number[] = [0x0a]
    writeVarint(wire.length, msg)
    const frame = new Uint8Array(5 + msg.length + wire.length)
    frame[0] = 0x00 // uncompressed grpc-web data frame
    const dv = new DataView(frame.buffer)
    dv.setUint32(1, msg.length + wire.length)
    frame.set(msg, 5)
    frame.set(wire, 5 + msg.length)
    return frame
}

/* Broadcast raw state-transition bytes. Tries each seed host in order until one
 * accepts. Resolves on success; throws DirectGrpcError with the decoded
 * consensus error text when drive rejects. */
export async function broadcastWireDirect(
    wire: Uint8Array,
    opts?: { network?: 'mainnet' | 'testnet'; hosts?: string[]; timeoutMs?: number },
): Promise<void> {
    const network = opts?.network ?? 'testnet'
    const hosts = opts?.hosts ?? DAPI_SEED_HOSTS[network]
    const timeoutMs = opts?.timeoutMs ?? 30_000
    const frame = buildFrame(wire)

    let lastErr: unknown
    for (const host of hosts) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
            const res = await fetch(`${host}/org.dash.platform.dapi.v0.Platform/BroadcastStateTransition`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/grpc-web+proto',
                    'x-grpc-web': '1',
                },
                body: Buffer.from(frame),
                signal: controller.signal,
            })
            clearTimeout(timer)
            const grpcStatus = res.headers.get('grpc-status')
            const grpcMessage = res.headers.get('grpc-message')
            const errBin = res.headers.get('dash-serialized-consensus-error-bin')
            let consensusText: string | undefined
            if (errBin) {
                try {
                    /* The rc.5 drive error-bin = CBOR {data:{serializedError:[1, 8, len, <base64 message>]}}
                     * or the raw printable error — extract any printable run. */
                    const raw = Buffer.from(errBin.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1')
                    const words = raw.match(/[\x20-\x7e]{12,}/g)
                    consensusText = words?.length ? words.join(' ') : raw.slice(0, 200)
                } catch { consensusText = undefined }
            }
            if (res.ok && (grpcStatus === null || grpcStatus === '0')) return
            throw new DirectGrpcError(
                grpcMessage ?? `HTTP ${res.status}`,
                grpcStatus ?? String(res.status),
                consensusText,
            )
        } catch (e) {
            clearTimeout(timer)
            lastErr = e
            if (e instanceof DirectGrpcError) {
                /* A drive-level rejection is authoritative: don't retry the other hosts. */
                throw e
            }
            /* Network/abort error: try the next host. */
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error('broadcastWireDirect: all DAPI hosts failed')
}
