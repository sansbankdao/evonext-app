// test/mocks/dash-sdk.ts

import { vi } from 'vitest'

export const mockIdentity = {
    getId: () => ({ toBuffer: () => Buffer.from('mock-id') }),
    getBalance: () => 100000,
}

export const mockClient = {
    platform: {
        identities: {
            get: vi.fn().mockResolvedValue(mockIdentity),
            register: vi.fn(),
        },
        names: {
            resolve: vi.fn(),
        },
    },
}
