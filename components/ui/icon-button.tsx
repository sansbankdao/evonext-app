import * as React from 'react'
import { cn } from '@/lib/utils'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'primary' | 'danger'
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ className, variant = 'default', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    'group relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200',
                    'hover:bg-gray-100 dark:hover:bg-gray-900',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-evonext-500',
                    'disabled:pointer-events-none disabled:opacity-50',
                    'interactive-scale',
                    {
                        'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100': variant === 'default',
                        'text-evonext-500 hover:text-evonext-600 hover:bg-evonext-50 dark:hover:bg-evonext-950': variant === 'primary',
                        'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950': variant === 'danger',
                    },
                    className
                )}
                {...props}
            />
        )
    }
)

IconButton.displayName = 'IconButton'
