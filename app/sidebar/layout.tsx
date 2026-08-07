export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ backgroundColor: 'transparent' }}>
      {children}
    </div>
  )
}

