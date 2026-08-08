export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`
        html, body {
          background: transparent !important;
          background-color: transparent !important;
        }
      `}</style>
      <div className="bg-transparent" style={{ background: 'transparent', minHeight: '100%' }}>
        {children}
      </div>
    </>
  )
}

