// test/mocks/handlers.ts

import { http, HttpResponse } from 'msw'

export const handlers = [
    http.get('https://api.dash.org/stats', () => {
        return HttpResponse.json({ status: 'online' })
    }),
]
