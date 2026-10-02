// test/unit/lib/retry-utils.test.ts

import { describe, it, expect, vi } from 'vitest'
import {
    retryAsync,
    retryPostCreation,
    isNetworkError,
    isRetryableError,
} from '@/lib/retry-utils'

describe('lib/retry-utils', () => {
    describe('isNetworkError / isRetryableError', () => {
        it('returns false for a falsy error', () => {
            expect(isNetworkError(null)).toBe(false)
            expect(isRetryableError(undefined)).toBe(false)
        })

        it('detects network-related messages', () => {
            expect(isNetworkError(new Error('Network Error'))).toBe(true)
            expect(isNetworkError(new Error('fetch failed'))).toBe(true)
            expect(isNetworkError(new Error('ETIMEDOUT'))).toBe(true)
            expect(isRetryableError(new Error('connection refused'))).toBe(true)
        })

        it('does not treat arbitrary errors as retryable', () => {
            expect(isNetworkError(new Error('invalid argument'))).toBe(false)
        })
    })

    describe('retryAsync', () => {
        it('returns success on the first attempt', async () => {
            const operation = vi.fn().mockResolvedValue('ok')
            const result = await retryAsync(operation)

            expect(result).toEqual({ success: true, data: 'ok', attempts: 1 })
            expect(operation).toHaveBeenCalledTimes(1)
        })

        it('retries a retryable error then succeeds', async () => {
            const operation = vi.fn()
                .mockRejectedValueOnce(new Error('network error'))
                .mockResolvedValueOnce('recovered')

            const result = await retryAsync(operation, {
                maxAttempts: 3,
                initialDelayMs: 0,
                maxDelayMs: 0,
            })

            expect(result.success).toBe(true)
            expect(result.data).toBe('recovered')
            expect(result.attempts).toBe(2)
            expect(operation).toHaveBeenCalledTimes(2)
        })

        it('does not retry a non-retryable error', async () => {
            const operation = vi.fn().mockRejectedValue(new Error('bad input'))
            const result = await retryAsync(operation, { maxAttempts: 3, initialDelayMs: 0 })

            expect(result.success).toBe(false)
            expect(result.attempts).toBe(3)
            // Stopped after the first attempt because the error is not retryable.
            expect(operation).toHaveBeenCalledTimes(1)
        })

        it('exhausts all attempts for a persistent retryable error', async () => {
            const operation = vi.fn().mockRejectedValue(new Error('timeout'))
            const result = await retryAsync(operation, {
                maxAttempts: 3,
                initialDelayMs: 0,
                maxDelayMs: 0,
            })

            expect(result.success).toBe(false)
            expect(result.error?.message).toBe('timeout')
            expect(result.attempts).toBe(3)
            expect(operation).toHaveBeenCalledTimes(3)
        })

        it('wraps non-Error rejections into an Error', async () => {
            const operation = vi.fn().mockRejectedValue('plain string')
            const result = await retryAsync(operation, { maxAttempts: 1, initialDelayMs: 0 })

            expect(result.success).toBe(false)
            expect(result.error).toBeInstanceOf(Error)
            expect(result.error?.message).toBe('plain string')
        })
    })

    describe('retryPostCreation', () => {
        it('retries on Dash Platform specific errors', async () => {
            const operation = vi.fn()
                .mockRejectedValueOnce(new Error('quorum not available'))
                .mockResolvedValueOnce('posted')

            const result = await retryPostCreation(operation, {
                maxAttempts: 3,
                initialDelayMs: 0,
                maxDelayMs: 0,
            })

            expect(result.success).toBe(true)
            expect(result.data).toBe('posted')
            expect(operation).toHaveBeenCalledTimes(2)
        })

        it('does not retry an unrelated error', async () => {
            const operation = vi.fn().mockRejectedValue(new Error('validation failed'))
            const result = await retryPostCreation(operation, {
                maxAttempts: 3,
                initialDelayMs: 0,
                maxDelayMs: 0,
            })

            expect(result.success).toBe(false)
            expect(operation).toHaveBeenCalledTimes(1)
        })
    })
})
