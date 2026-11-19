// lib/mnemonic-diagnostics.ts
//
// F57b — the DIAGNOSTIC error for a rejected recovery phrase. The old
// behavior was a blanket "Oops! Those seed words are INVALID!" toast with
// zero guidance; live reports (2026-11-16) showed VALID phrases failing —
// the paste path split on single spaces only, so a phrase containing a
// newline / double space / tab (typical of password managers and notes
// apps) produced contaminated words and a false rejection.
//
// This module: (a) the paste NORMALIZATION (any-whitespace split + trim +
// lowercase — the BIP39 English wordlist has no case-distinguished pairs),
// and (b) a diagnosis that names the actual problem: the word COUNT, the
// words that are not in the BIP39 wordlist (with their positions), or the
// all-words-valid-but-checksum case.

import { validateMnemonic } from '@scure/bip39'
import { wordlist as ENGLISH } from '@scure/bip39/wordlists/english.js'

/** Normalize a pasted/typed phrase: trim, lowercase, collapse ALL
 * whitespace runs (spaces, tabs, newlines) to single spaces. */
export function normalizePhrase(input: string): string {
    return input.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** F63b — the PURE-JS BIP39 validation — the EXACT chain the connect
 * page's login uses (normalizePhrase → @scure validateMnemonic): the
 * previous wasm `validate_mnemonic` crashed with the glue-before-load
 * "reading '__wbindgen_malloc'" class when a phrase was pasted before
 * the engine loaded. This check has NO wasm dependency and @scure does
 * NOT normalize itself (raw mixed case / whitespace → false), so the
 * normalization runs here — acceptance is the same BIP39 spec. */
export function isValidPhrase(input: string): boolean {
    return validateMnemonic(normalizePhrase(input), ENGLISH)
}

/** The normalized non-empty words of a phrase. */
export function wordsOf(input: string): string[] {
    const n = normalizePhrase(input)
    return n.length ? n.split(' ') : []
}

/**
 * Diagnose a phrase that the wasm BIP39 validation rejected. Returns a
 * human, actionable message — SPECIFIC about what to fix. Assumes the
 * caller already ran the wasm validation (this does not re-validate the
 * checksum; it only classifies the failure).
 */
export async function diagnoseRejectedPhrase(input: string): Promise<string> {
    /* The RAW scan first (no lowercase): a case mismatch is its own fix —
     * the callers that pre-normalize (the connect page) never hit it, but
     * a raw unnormalized phrase gets the precise guidance. */
    const rawWords = input.trim().split(/\s+/).filter(Boolean)
    const caseBad = rawWords
        .map((w, i) => ({ idx: i + 1, word: w }))
        .filter(({ word }) =>
            !(ENGLISH as readonly string[]).includes(word)
            && (ENGLISH as readonly string[]).includes(word.toLowerCase()))
    if (caseBad.length > 0) {
        const first = caseBad[0]
        const listed = caseBad.slice(0, 3).map((b) => `#${b.idx} "${b.word}"`).join(', ')
        const more = caseBad.length > 3 ? ` (+${caseBad.length - 3} more)` : ''
        return `These words must be lowercase (recovery phrases are lowercase BIP39 words): ${listed}${more}.`
    }

    const words = wordsOf(input)

    if (words.length === 0) {
        return 'No recovery phrase entered — fill in your 12 or 24 words.'
    }

    if (words.length !== 12 && words.length !== 24) {
        const hint = words.length > 12 && words.length < 24
            ? ' If your phrase is 24 words, use the "switch to 24 word seed phrase" button below the fields.'
            : ''
        return `You entered ${words.length} words — a recovery phrase is exactly 12 or 24 words.${hint}`
    }

    /* The wordlist check: report the non-list words with their positions
     * (1-based, like the grid labels "Word #N"). The list is lowercase —
     * a case mismatch is reported as its own fix. */
    const bad: Array<{ idx: number; word: string; caseIssue: boolean }> = []
    for (let i = 0; i < words.length; i++) {
        const w = words[i]
        if (!(ENGLISH as readonly string[]).includes(w)) {
            const caseIssue = (ENGLISH as readonly string[]).includes(w.toLowerCase())
            bad.push({ idx: i + 1, word: w, caseIssue })
        }
    }
    if (bad.length > 0) {
        const first = bad[0]
        if (bad.length === 1 && first.caseIssue) {
            return `Word ${first.idx} ("${first.word}") must be lowercase — recovery phrases are lowercase BIP39 words.`
        }
        const listed = bad.slice(0, 3).map((b) => `#${b.idx} "${b.word}"`).join(', ')
        const more = bad.length > 3 ? ` (+${bad.length - 3} more)` : ''
        return `These are not valid BIP39 words: ${listed}${more} — check them for typos.`
    }

    /* Every word is a valid BIP39 word → the checksum/order is the issue
     * (or the words belong to a DIFFERENT phrase standard, e.g. Electrum —
     * which the Dash Platform SDK does not accept). */
    return 'Every word is a valid BIP39 word, but the checksum fails — check the word ORDER for typos or swaps. If this phrase comes from another wallet standard (e.g. Electrum), it cannot be used here.'
}
