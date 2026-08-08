'use client'

import { Menu, PanelLeft } from 'lucide-react'
import IconButton from '../ui/IconButton'

interface SidebarHeaderProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
  onOpenAppMenu?: () => void
}

export default function SidebarHeader({
  collapsed = false,
  onToggleCollapse,
  onOpenAppMenu,
}: SidebarHeaderProps) {
  if (collapsed) {
    return (
      <div className="app-drag flex flex-col items-center gap-2 border-b border-riven-border px-2 py-3">
        <IconButton
          size="sm"
          className="app-no-drag"
          onClick={onOpenAppMenu}
          title="Menu"
        >
          <Menu className="h-4 w-4" />
        </IconButton>
        <IconButton
          size="sm"
          className="app-no-drag"
          onClick={onToggleCollapse}
          title="Ouvrir la sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </IconButton>
      </div>
    )
  }

  return (
    <div className="app-drag flex items-center justify-between border-b border-riven-border px-3 py-3">
      <IconButton
        size="sm"
        className="app-no-drag"
        onClick={onOpenAppMenu}
        title="Menu"
      >
        <Menu className="h-4 w-4" />
      </IconButton>
      <IconButton
        size="sm"
        className="app-no-drag"
        onClick={onToggleCollapse}
        title="Fermer la sidebar"
      >
        <PanelLeft className="h-4 w-4" />
      </IconButton>
    </div>
  )
}
