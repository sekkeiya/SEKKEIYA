import type { TLBaseShape } from 'tldraw'
import { HTMLContainer, Rectangle2d, ShapeUtil, resizeBox } from 'tldraw'

export type MoodBoardShape = TLBaseShape<
  'moodboard',
  { w: number; h: number; keyword: string; imgUrl?: string }
>

export class MoodBoardShapeUtil extends ShapeUtil<any> {
  static override type = 'moodboard' as const
  override isAspectRatioLocked = () => false
  override canResize = () => true
  override canBind = () => true

  override getDefaultProps() {
    return {
      w: 240,
      h: 240,
      keyword: 'コンセプト画像',
      imgUrl: ''
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
    const { keyword, imgUrl } = shape.props

    return (
      <HTMLContainer
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#f5f5f5',
          border: '1px solid #ccc',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'all',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ padding: '8px', backgroundColor: '#fff', borderBottom: '1px solid #eee', fontSize: '0.85rem', fontWeight: 'bold', color: '#333' }}>
          📌 {keyword}
        </div>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaeaea' }}>
          {imgUrl ? (
            <img src={imgUrl} alt={keyword} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', fontSize: '0.8rem', textAlign: 'center', padding: '10px' }}>
              画像なし<br/>(D&Dで今後実装予定)
            </span>
          )}
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: any) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  override onResize(shape: any, info: any) {
    return resizeBox(shape, info)
  }
}
