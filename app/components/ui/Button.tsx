'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'outline'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-riven-card border border-riven-border text-riven-text-primary hover:border-riven-accent disabled:opacity-40 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-riven-text-secondary hover:text-riven-text-primary disabled:opacity-40',
  outline:
    'bg-transparent border border-riven-border text-riven-text-primary hover:border-riven-accent disabled:opacity-40',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-riven px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-riven-accent ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
)

Button.displayName = 'Button'

export default Button
