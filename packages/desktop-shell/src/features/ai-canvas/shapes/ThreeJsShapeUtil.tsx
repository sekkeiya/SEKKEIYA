import type { TLBaseShape } from 'tldraw'
import { HTMLContainer, Rectangle2d, ShapeUtil, resizeBox } from 'tldraw'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import { Suspense } from 'react'

export type ThreeJsShape = TLBaseShape<
  'threejs',
  { w: number; h: number; color: string; modelType: 'box' | 'sphere' | 'torus' }
>

const ModelPlaceholder = ({ type }: { type: 'box' | 'sphere' | 'torus' }) => {
  return (
    <mesh>
      {type === 'box' && <boxGeometry args={[1, 1, 1]} />}
      {type === 'sphere' && <sphereGeometry args={[0.7, 32, 32]} />}
      {type === 'torus' && <torusGeometry args={[0.5, 0.2, 16, 100]} />}
      <meshStandardMaterial color="#00C0FF" roughness={0.1} metalness={0.8} />
    </mesh>
  )
}

export class ThreeJsShapeUtil extends ShapeUtil<any> {
  static override type = 'threejs' as const
  override isAspectRatioLocked = () => false
  override canResize = () => true
  override canBind = () => true
  override canEdit = () => false // 3D models are edited via right panel

  override getDefaultProps() {
    return {
      w: 300,
      h: 300,
      color: '#282828',
      modelType: 'box'
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
    const { color, modelType } = shape.props

    return (
      <HTMLContainer
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: color,
          border: '1px solid #444',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'all',
          overflow: 'hidden',
          boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
        }}
        // Important: Stop propagation so panning 3D model doesn't pan the 2D canvas
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <Suspense fallback={<div style={{ color: 'var(--brand-fg)', fontFamily: 'sans-serif' }}>Loading 3D...</div>}>
          <Canvas shadows dpr={[1, 2]} camera={{ position: [3, 3, 3], fov: 50 }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 10]} intensity={1} castShadow />
            <Stage environment="city" intensity={0.5} adjustCamera={1.2}>
              <ModelPlaceholder type={modelType || 'box'} />
            </Stage>
            <OrbitControls makeDefault enableZoom={true} enablePan={false} />
          </Canvas>
        </Suspense>
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
