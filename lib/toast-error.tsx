/* lib/toast-error.tsx */
/* Shared PERSISTENT error toast — errors must NOT flash and vanish; they
 * stay on-screen until the user dismisses them with the X button. */

import React from 'react'
import toast, { type Toast } from 'react-hot-toast'
import { X } from 'lucide-react'

/* Show an error that stays on-screen until dismissed. Returns the toast id. */
export function showErrorToast(_message: string) {
    return toast.custom(
        (t: Toast) => (
            <div
                role="alert"
                className={`flex max-w-md items-start gap-3 rounded-lg bg-red-600 px-4 py-3 text-sm text-white shadow-lg transition-all ${
                    t.visible ? 'animate-enter' : 'animate-leave'
                }`}
            >
                <span className="flex-1 break-words leading-snug">
                    {_message}
                </span>

                <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => toast.dismiss(t.id)}
                    className="shrink-0 rounded p-0.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        ),
        { duration: Infinity },
    )
}
