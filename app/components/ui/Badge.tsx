'use client'

type BadgeVariant = 'green' | 'purple' | 'blue' | 'default'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  green: 'bg-riven-tag-green-bg text-riven-tag-green border-riven-tag-green/30',
  purple: 'bg-riven-tag-purple-bg text-riven-tag-purple border-riven-tag-purple/30',
  blue: 'bg-riven-tag-blue-bg text-riven-tag-blue border-riven-tag-blue/40',
  default: 'bg-riven-card text-riven-text-secondary border-riven-border',
}

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
