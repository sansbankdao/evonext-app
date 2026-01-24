// app/.well-known/assetlinks.json

import { NextResponse } from 'next/server'

const SHA_HEX_VALUE = '0x0'

export async function GET() {
    const data = [{
        'relation': ['delegate_permission/common.get_login_creds'],
        'target': {
            'namespace': 'android_app',
            'package_name': 'com.example',
            'sha256_cert_fingerprints': [
                SHA_HEX_VALUE
            ]
        }
        }]

    return NextResponse.json(data)
}
