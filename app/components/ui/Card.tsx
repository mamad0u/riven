'use client'

interface CardProps {
  children: React.ReactNode
  className?: string
  selected?: boolean
  onClick?: () => void
}

export default function Card({ children, className = '', selected = false, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-riven-lg border bg-riven-card p-4 transition-colors ${
        selected
          ? 'border-riven-accent bg-riven-selected'
          : 'border-riven-border hover:border-riven-accent'
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
