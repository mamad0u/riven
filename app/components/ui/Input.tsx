'use client'

import { InputHTMLAttributes, forwardRef } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement>

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`app-no-drag w-full rounded-riven border border-riven-border bg-riven-input px-3 py-2 text-sm text-riven-text-primary placeholder:text-riven-text-secondary focus:border-riven-accent focus:outline-none ${className}`}
      {...props}
    />
  )
)

Input.displayName = 'Input'

export default Input
