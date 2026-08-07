'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  size?: 'sm' | 'md'
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ active = false, size = 'md', className = '', children, ...props }, ref) => {
    const sizeClass = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center rounded-riven border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-riven-accent disabled:opacity-40 ${
          active
            ? 'border-riven-accent bg-riven-selected text-riven-accent'
            : 'border-riven-border bg-riven-card text-riven-text-secondary hover:border-riven-accent hover:text-riven-text-primary'
        } ${sizeClass} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'

export default IconButton
