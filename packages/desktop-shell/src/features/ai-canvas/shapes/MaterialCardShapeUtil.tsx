import type { TLBaseShape } from 'tldraw'
import { HTMLContainer, Rectangle2d, ShapeUtil, resizeBox } from 'tldraw'

export type MaterialCardShape = TLBaseShape<
  'material_card',
  { 
    w: number; 
    h: number; 
    materialName: string;
    maker: string;
    specs: string;
    imageUrl: string; 
  }
>

export class MaterialCardShapeUtil extends ShapeUtil<any> {
  static override type = 'material_card' as const
  override isAspectRatioLocked = () => false
  override canResize = () => true
  override canBind = () => true

  override getDefaultProps() {
    return {
      w: 240,
      h: 320,
      materialName: 'Material Name',
      maker: 'Maker / Brand',
      specs: 'Color: White\nFinish: Matte',
      imageUrl: '', // default to empty
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
    const { materialName, maker, specs, imageUrl } = shape.props

    return (
      <HTMLContainer
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'all',
          boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
          fontFamily: 'Inter, "Helvetica Neue", sans-serif'
        }}
      >
        {/* Image Section */}
        <div 
          style={{ 
            width: '100%', 
            flexGrow: 1, 
            backgroundColor: '#f5f5f5',
            backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {!imageUrl && <span style={{ color: '#bdbdbd', fontSize: '0.9rem' }}>No Image</span>}
        </div>

        {/* Specs Section */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #eee',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          backgroundColor: '#fff',
          height: '100px', // Fixed height for text area
          minHeight: '100px'
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {materialName}
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#757575', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {maker}
          </span>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#555', whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {specs}
          </p>
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: MaterialCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  override onResize(shape: any, info: any) {
    return resizeBox(shape, info)
  }
}
