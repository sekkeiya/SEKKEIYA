import type { TLBaseShape } from 'tldraw'
import { HTMLContainer, Rectangle2d, ShapeUtil, resizeBox } from 'tldraw'

export type DimensionLineShape = TLBaseShape<
  'dimension_line',
  {
    w: number;
    h: number;
    text: string;
  }
>

export class DimensionLineShapeUtil extends ShapeUtil<any> {
  static override type = 'dimension_line' as const
  override isAspectRatioLocked = () => false
  override canResize = () => true
  override canBind = () => true

  override getDefaultProps() {
    return {
      w: 200,
      h: 40, // Base height constraint for the bounding box
      text: '2000'
    }
  }

  override getGeometry(shape: DimensionLineShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override component(shape: DimensionLineShape) {
    const { w, h, text } = shape.props
    const cy = h / 2

    return (
      <HTMLContainer
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none' // Let clicks pass through except on our elements
        }}
      >
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          {/* Main Line */}
          <line x1={0} y1={cy} x2={w} y2={cy} stroke="#333" strokeWidth={1.5} />
          {/* Tick Marks (Architectural slashes) */}
          <line x1={-5} y1={cy + 5} x2={5} y2={cy - 5} stroke="#333" strokeWidth={1.5} />
          <line x1={w - 5} y1={cy + 5} x2={w + 5} y2={cy - 5} stroke="#333" strokeWidth={1.5} />
        </svg>
        <div style={{
          position: 'relative',
          marginTop: '-24px', // Shift text slightly above the line
          backgroundColor: 'transparent',
          padding: '0 4px',
          fontSize: '12px',
          fontFamily: 'Inter, monospace',
          color: '#333',
          pointerEvents: 'all' // allow selection by clicking text
        }}>
          {text}
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: DimensionLineShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  override onResize(shape: any, info: any) {
    return resizeBox(shape, info)
  }
}
