'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import Badge from '../ui/Badge'
import type { VariableDefinition, VariableRegistry } from '@/app/lib/variableRegistry'
import {
  interpolateVariableRefs,
  normalizeVariableDefinition,
} from '@/app/lib/variableRegistry'

interface ModuleVariableProps {
  config?: Partial<VariableDefinition> | null
  value: string[]
  onChange: (value: string[]) => void
  otherValues?: Record<string, string>
  registry?: VariableRegistry
}

export default function ModuleVariable({
  config,
  value,
  onChange,
  otherValues = {},
  registry = {},
}: ModuleVariableProps) {
  const cfg = normalizeVariableDefinition(config)
  const [open, setOpen] = useState(false)
  const [customDraft, setCustomDraft] = useState('')

  useEffect(() => {
    if (!cfg.multi && value.length > 1) onChange(value.slice(0, 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.multi])

  const toggle = (v: string) => {
    if (cfg.multi) {
      onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
      return
    }
    onChange(value.includes(v) ? [] : [v])
    setOpen(false)
  }

  const addCustom = () => {
    const v = customDraft.trim()
    if (!v) return
    onChange(cfg.multi ? (value.includes(v) ? value : [...value, v]) : [v])
    setCustomDraft('')
    if (!cfg.multi) setOpen(false)
  }

  const canCustom = cfg.allowCustom || cfg.options.length === 0
  const preview = interpolateVariableRefs(value.join(', '), otherValues, registry)
  const parentHint =
    cfg.aliasOf && cfg.childMode === 'pick' ? `Parmi ${cfg.aliasOf}` : null

  return (
    <div className="rounded-riven-lg border border-riven-border bg-riven-card p-4">
      <p className="mb-1 text-xs text-riven-text-secondary">
        <span className="font-mono text-riven-accent">{cfg.id}</span>
        {parentHint ? ` · ${parentHint}` : ''}
      </p>
      <div className="relative mt-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between rounded-riven border border-riven-border bg-riven-input px-3 py-2 text-left text-sm"
        >
          {value.length === 0 ? (
            <span className="text-riven-text-secondary">Choisir…</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {value.map((v) => (
                <Badge key={v} variant="default">
                  {v}
                </Badge>
              ))}
            </span>
          )}
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
        </button>
        {value.length > 0 && preview !== value.join(', ') && (
          <p className="mt-1.5 text-[11px] text-riven-text-secondary">→ {preview}</p>
        )}
        {open && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-riven border border-riven-border bg-riven-card shadow-xl">
            {cfg.options.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => toggle(v)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-riven-selected ${
                  value.includes(v) ? 'text-riven-accent' : 'text-riven-text-primary'
                }`}
              >
                {v}
              </button>
            ))}
            {canCustom && (
              <div className="flex gap-2 border-t border-riven-border p-2">
                <input
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustom()
                    }
                  }}
                  placeholder="Autre…"
                  className="min-w-0 flex-1 rounded-riven border border-riven-border bg-riven-input px-2 py-1.5 text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addCustom}
                  className="shrink-0 rounded-riven border border-riven-border px-2.5 text-xs hover:bg-riven-selected"
                >
                  OK
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                onChange([])
                setOpen(false)
              }}
              className="w-full border-t border-riven-border px-3 py-2 text-left text-xs text-riven-text-secondary hover:bg-riven-selected"
            >
              Laisser vide
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
