import type { TLBaseShape } from 'tldraw'
import { HTMLContainer, Rectangle2d, ShapeUtil, resizeBox, useIsEditing } from 'tldraw'
import mermaid from 'mermaid'
import { useEffect, useRef, useState } from 'react'

export type MermaidShape = TLBaseShape<
  'mermaid',
  { w: number; h: number; code: string; color: string }
>

export class MermaidShapeUtil extends ShapeUtil<any> {
  static override type = 'mermaid' as const
  override isAspectRatioLocked = () => false
  override canResize = () => true
  override canBind = () => true
  override canEdit = () => true

  override getDefaultProps() {
    return {
      w: 400,
      h: 300,
      code: `graph TD;\n    A[Idea]-->B[Concept];\n    B-->C[Plan];\n    C-->D[Execution];\n    D-->A;`,
      color: 'var(--brand-fg)',
    }
  }

  override getGeometry(shape: MermaidShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override component(shape: any) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isEditing = useIsEditing(shape.id)
    const { code, color } = shape.props
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [svgContent, setSvgContent] = useState<string>('')
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const containerRef = useRef<HTMLDivElement>(null)

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      mermaid.initialize({ startOnLoad: false, theme: 'default' })
      let isMounted = true
      
      const renderMermaid = async () => {
        try {
          const id = `mermaid-${shape.id.replace(':', '-')}`
          const { svg } = await mermaid.render(id, code)
          if (isMounted) {
            setSvgContent(svg)
          }
        } catch (error) {
          console.error("Mermaid parsing error:", error)
          if (isMounted) {
            setSvgContent(`<div style="color:red; padding:10px; font-family: sans-serif;">Error parsing Mermaid code. Please check syntax.</div>`)
          }
        }
      }

      if (code) {
        renderMermaid()
      }

      return () => {
        isMounted = false
      }
    }, [code, shape.id])

    return (
      <HTMLContainer
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: color,
          border: isEditing ? '2px solid #42a5f5' : '1px solid #ccc',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'all',
          overflow: 'hidden',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}
      >
        {isEditing ? (
          <textarea
            style={{
              width: '100%',
              height: '100%',
              resize: 'none',
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '14px',
              border: 'none',
              outline: 'none',
              backgroundColor: 'var(--brand-surface2)',
              color: 'var(--brand-fg)'
            }}
            defaultValue={code}
            autoFocus
            onBlur={(e) => {
              this.editor.updateShape<MermaidShape>({
                id: shape.id,
                type: 'mermaid',
                props: { code: e.target.value }
              })
            }}
            onKeyDown={(e) => {
              e.stopPropagation() // Prevent Tldraw shortcuts while typing
            }}
            onPointerDown={(e) => {
              e.stopPropagation() // Prevent Tldraw from stealing focus
            }}
          />
        ) : (
          <div 
            ref={containerRef}
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
            dangerouslySetInnerHTML={{ __html: svgContent }} 
            onPointerDown={() => {
              // Only let double click through to trigger editing, or let pan work.
              // We'll just let Tldraw handle standard shape pointer events.
            }}
          />
        )}
      </HTMLContainer>
    )
  }

  override indicator(shape: MermaidShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  override onResize(shape: any, info: any) {
    return resizeBox(shape, info)
  }
}
