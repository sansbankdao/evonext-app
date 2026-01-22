// app/.well-known/apple-app-site-association

import { NextResponse } from 'next/server'

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
