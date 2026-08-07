'use client'

import { forwardRef } from 'react'
import Input from '../ui/Input'

interface TagSearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
  placeholder?: string
}

const TagSearchInput = forwardRef<HTMLInputElement, TagSearchInputProps>(
  function TagSearchInput(
    {
      value,
      onChange,
      onSubmit,
      placeholder = 'Écris ou recherche un tag',
    },
    ref
  ) {
    return (
      <Input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault()
            onSubmit(value)
          }
        }}
        placeholder={placeholder}
        data-tag-search="true"
        className="text-sm"
      />
    )
  }
)

export default TagSearchInput
