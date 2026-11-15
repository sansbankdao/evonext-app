/* test/unit/lib/mnemonic-diagnostics.test.mts
 * F57b — the diagnostic rejection for a refused recovery phrase (the
 * blanket "INVALID" toast replaced) + the paste normalization that fixes
 * the false rejections (a phrase pasted with newlines / double spaces /
 * tabs previously produced contaminated words). */
import { describe, it, expect } from 'vitest'
import {
    normalizePhrase,
    wordsOf,
    diagnoseRejectedPhrase,
} from '../../../lib/mnemonic-diagnostics'

const VALID_12 = 'legal winner thank year wave sausage worth useful legal winner thank yellow'

describe('mnemonic-diagnostics (F57b)', () => {
    it('normalizePhrase: trims, lowercases, and collapses ALL whitespace runs', () => {
        expect(normalizePhrase('  Legal   winner\tthank\nyear  '))
            .toBe('legal winner thank year')
        expect(normalizePhrase('legal\nwinner\nthank')).toBe('legal winner thank')
        expect(normalizePhrase(' legal  winner ')).toBe('legal winner')
    })

    it('wordsOf: a newline/double-space separated phrase yields CLEAN words', () => {
        expect(wordsOf('legal\nwinner  thank year wave sausage worth useful legal\nwinner thank yellow'))
            .toEqual(VALID_12.split(' '))
    })

    it('the word-count diagnosis (13–23 words → the 24-word toggle hint)', async () => {
        /* A genuine 13-word phrase (all valid list words — the count is
         * the only failure). */
        const d = await diagnoseRejectedPhrase(VALID_12 + ' legal')
        expect(d).toContain('13 words')
        expect(d).toContain('switch to 24 word seed phrase')
    })

    it('the non-wordlist diagnosis names the word and its position', async () => {
        const words = VALID_12.split(' ')
        words[6] = 'wrod'
        const d = await diagnoseRejectedPhrase(words.join(' '))
        expect(d).toContain('#7')
        expect(d).toContain('"wrod"')
        expect(d).toContain('typos')
    })

    it('the case diagnosis (an uppercase word — the RAW, unnormalized input)', async () => {
        /* The connect page normalizes BEFORE validating, so this branch
         * only fires for a raw unnormalized phrase. */
        const words = VALID_12.split(' ')
        words[2] = 'THANK'
        const d = await diagnoseRejectedPhrase(words.join(' '))
        expect(d).toContain('lowercase')
    })

    it('the all-words-valid diagnosis → the checksum message', async () => {
        /* A 12-word phrase of VALID list words that is NOT our valid
         * checksum phrase. */
        const words = VALID_12.split(' ').reverse().join(' ')
        const d = await diagnoseRejectedPhrase(words)
        expect(d).toContain('checksum')
    })

    it('the empty input diagnosis', async () => {
        const d = await diagnoseRejectedPhrase('   ')
        expect(d).toContain('No recovery phrase entered')
    })
})
