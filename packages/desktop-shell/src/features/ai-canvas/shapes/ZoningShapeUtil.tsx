import type { TLBaseShape } from 'tldraw'
import { HTMLContainer, Rectangle2d, ShapeUtil, resizeBox } from 'tldraw'

export type ZoningShape = TLBaseShape<
  'zoning',
  { w: number; h: number; text: string; color: string }
>

export class ZoningShapeUtil extends ShapeUtil<any> {
  static override type = 'zoning' as const
  override isAspectRatioLocked = () => false
  override canResize = () => true
  override canBind = () => true

  override getDefaultProps() {
    return {
      w: 150,
      h: 150,
      text: 'LDK',
      color: '#FFF9C4', // standard light yellow
    }
  }

  override getGeometry(shape: any) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override component(shape: any) {
    const { w, h, text, color } = shape.props
    
    // Tldraw units to meters (assuming 1m = 50 units for architectural scale feel)
    // 1 m2 = 2500 units^2.
    const areaM2 = ((w * h) / 2500)
    // 1 tsubo = 3.3m2
    const areaTsubo = areaM2 / 3.3

    return (
      <HTMLContainer
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: color,
          border: '2px solid #555',
          borderRadius: '4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'all',
          opacity: 0.9,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}
      >
        <span style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#333' }}>
          {text}
        </span>
        <span style={{ margin: 0, fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
          {areaM2.toFixed(1)} ㎡ / {areaTsubo.toFixed(1)} 坪
        </span>
      </HTMLContainer>
    )
  }

  override indicator(shape: ZoningShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  override onResize(shape: any, info: any) {
    return resizeBox(shape, info)
  }
}
