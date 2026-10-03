// app/.well-known/apple-app-site-association

import { NextResponse } from 'next/server'

// Required by Next 15 for route handlers under `output: 'export'`.
export const dynamic = 'force-static'

export async function GET() {
    const data = {
        applinks: {},
        webcredentials: {
            apps: ['XXXXXXXXXX.YYY.YYYYY.YYYYYYYYYYYYYY'],
        },
        appclips: {},
    }

    return NextResponse.json(data)
}
