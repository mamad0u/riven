'use client'

import { TextareaHTMLAttributes, forwardRef } from 'react'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`w-full rounded-riven border border-riven-border bg-riven-input px-3 py-2 text-sm text-riven-text-primary placeholder:text-riven-text-secondary focus:border-riven-accent focus:outline-none resize-none font-mono ${className}`}
      {...props}
    />
  )
)

Textarea.displayName = 'Textarea'

export default Textarea
