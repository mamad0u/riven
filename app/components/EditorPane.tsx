'use client'

import { forwardRef } from 'react'
import RichModuleEditor, { type RichModuleEditorHandle } from './RichModuleEditor'

export type EditorPaneHandle = RichModuleEditorHandle

interface EditorPaneProps {
  content: string
  onChange: (content: string) => void
}

const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(function EditorPane(
  { content, onChange },
  ref
) {
  return <RichModuleEditor ref={ref} content={content} onChange={onChange} />
})

export default EditorPane
