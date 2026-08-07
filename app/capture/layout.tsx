export default function CaptureLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ backgroundColor: 'transparent', width: '100%', height: '100%' }}>
      {children}
    </div>
  )
}
