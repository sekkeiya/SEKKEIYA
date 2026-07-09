import type { TLBaseShape } from 'tldraw'
import { HTMLContainer, Rectangle2d, ShapeUtil, resizeBox } from 'tldraw'

export type ColorPaletteShape = TLBaseShape<
  'color_palette',
  { 
    w: number; 
    h: number; 
    colors: string[]; // array of hex strings
  }
>

export class ColorPaletteShapeUtil extends ShapeUtil<any> {
  static override type = 'color_palette' as const
  override isAspectRatioLocked = () => false
  override canResize = () => true
  override canBind = () => true

  override getDefaultProps() {
    return {
      w: 300,
      h: 80,
      colors: ['#D7CCC8', '#BCAAA4', '#8D6E63', '#5D4037', '#3E2723'], // Default warm architectural palette
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
    const { colors } = shape.props

    return (
      <HTMLContainer
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'transparent',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'all',
          gap: '8px'
        }}
      >
        {colors.map((color: string, index: number) => (
          <div 
            key={index} 
            style={{
              flex: 1,
              height: '100%',
              backgroundColor: color,
              borderRadius: '50%', // Circle swatches
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Optional: Add a hover effect to show hex code if needed, but keeping it clean for presentation */}
          </div>
        ))}
      </HTMLContainer>
    )
  }

  override indicator(shape: ColorPaletteShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={shape.props.h / 2} ry={shape.props.h / 2} />
  }

  override onResize(shape: any, info: any) {
    return resizeBox(shape, info)
  }
}
