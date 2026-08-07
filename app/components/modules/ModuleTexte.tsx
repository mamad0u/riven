'use client'

interface ModuleTexteProps {
  label?: string
  value: string
  onChange: (value: string) => void
}

export default function ModuleTexte({ label = 'Rename par l\'utilisateur', value, onChange }: ModuleTexteProps) {
  return (
    <div className="rounded-riven-lg border border-riven-border bg-riven-card p-4">
      <p className="mb-1 text-xs text-riven-text-secondary">Module Texte</p>
      <p className="mb-3 text-sm text-riven-text-primary">{label}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rentre du texte"
        className="w-full rounded-riven border border-riven-border bg-riven-input px-3 py-2 text-sm text-riven-text-primary placeholder:text-riven-text-secondary focus:border-riven-accent focus:outline-none"
      />
    </div>
  )
}
