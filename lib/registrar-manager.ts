

/**
 * CHECK FOR EXISTING (PENDING) ORDER
 *
 * ATTEMPT TO AUTO-COMPLETE THE REGISTRATION PROCESS
 */
export const checkPendingStatus = async (_masterKey: string) => {
    /* Initialize locals. */
    let username
    let proof
    let wif

    /* Set (request) headers. */
    const headers = {
        'Authorization': `Bearer ${_masterKey}`
    }

    /* Make status request. */
    const statusResponse = await fetch('https://evonext.app/v1/registrar/status', {
        method: 'GET',
        headers,
    }).catch(err => console.error(err))

    /* Handle status response. */
    const status = await statusResponse!.json()
console.log('ORDER STATUS CHECK', status)

    /* Validate (pending) status. */
    if (
        typeof status !== 'undefined' &&
        status !== null &&
        status.results &&
        status.results.length > 0
    ) {
        /* Set username. */
        username = status.results[0].username
console.log('USERNAME', username)

        /* Set proof. */
        proof = status.results[0].proof
console.log('PROOF', typeof proof, proof)

        /* Set WIF. */
        wif = status.results[0].wif
console.log('WIF', typeof wif, wif)

        /* Return registration credentials. */
        return {
            username,
            proof,
            wif,
        }
    } else {
        return null
    }
}
