import os

path = r"c:\Users\sekkeiya\02-WebApp\040-sekkeiya\sekkeiya-desktop\src\features\dsl\layout\canvas\viewports\SingleViewportCanvas.jsx"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

broken_str = """      <SmoothAlignFollower
        active={!!isAlignOwner && !!alignMode && !materialPicking}
        primaryObject={selectedObject}
        selectedObjects={alignSelectedObjects}
        alignMode={alignMode}
        groundY={groundY}
        snapAxisValue={snapAxisValue}
        baseCollidersRef={baseCollidersRef}
        baseBoundsRef={baseBoundsRef}
        wallEps={0.02}
        wallMaxDist={200}
        lastNdcRef={lastAlignNdcRef}
        damping={32}
        getSnapActive={getSnapActive}
        <PerspectiveCamera 
            makeDefault 
            fov={50} near={0.1} far={100000} 
            onUpdate={(c) => {"""

correct_str = """      <SmoothAlignFollower
        active={!!isAlignOwner && !!alignMode && !materialPicking}
        primaryObject={selectedObject}
        selectedObjects={alignSelectedObjects}
        alignMode={alignMode}
        groundY={groundY}
        snapAxisValue={snapAxisValue}
        baseCollidersRef={baseCollidersRef}
        baseBoundsRef={baseBoundsRef}
        wallEps={0.02}
        wallMaxDist={200}
        lastNdcRef={lastAlignNdcRef}
        damping={32}
        getSnapActive={getSnapActive}
        getAbortAlign={() => alignAbortRef.current}
        onPreviewTransform={onChangeTransform}
        onPreviewTransforms={onChangeTransforms}
        previewItemId={selectedItemId}
        previewThrottleMs={33}
        snapEngineRef={snapEngineRef}
        snapDotRef={snapDotRef}
        snapGuideValueRef={snapGuideValueRef}
        snapFinalAnchorRef={snapFinalAnchorRef}
      />

      {isAlignOwner && alignMode && (
        <SnapGuide axis={alignMode.axis} valueRef={snapGuideValueRef} pointRef={snapDotRef} />
      )}

      <AlignPointerController
        enabled={!!isAlignOwner && !!alignMode && !materialPicking}
        onConfirm={commitAlign}
        lastNdcRef={lastAlignNdcRef}
        isNavActive={isNavActive}
        getSnapActive={getSnapActive}
      />

      {type === VIEW_TYPES.PERSPECTIVE && (
        <PerspectiveCamera 
            makeDefault 
            fov={50} near={0.1} far={100000} 
            onUpdate={(c) => {"""

if broken_str in text:
    text = text.replace(broken_str, correct_str)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print("Fixed via replace 1")

broken_str2 = """
    <OrbitControls
          ref={orbitRef}
          enableDamping={false}
          enableRotate={editorMode !== "layout"}
          mouseButtons={{
                LEFT: null,
            MIDDLE: THREE.MOUSE.ROTATE,
            RIGHT: null,
          }}
        />
        <PerspectiveControlsBinder
          mouseEnabled={!alignMode && !isGizmoDragging}
          keyboardEnabled={active && !alignMode && !isGizmoDragging}
          enabled={active && !alignMode && !isGizmoDragging}
          orbitRef={orbitRef}
          selectedObject={selectedObject}
          moveSpeed={speedPreset.move}
          verticalSpeed={speedPreset.vertical}
          onSpeedChange={onSpeedMulChange}
        />"""

correct_str2 = """
    <OrbitControls
          ref={orbitRef}
          enableDamping={false}
          enableRotate={editorMode !== "layout"}
          mouseButtons={{
                LEFT: null,
            MIDDLE: THREE.MOUSE.ROTATE,
            RIGHT: null,
          }}
        />
        <PerspectiveControlsBinder
          mouseEnabled={!alignMode && !isGizmoDragging}
          keyboardEnabled={active && !alignMode && !isGizmoDragging}
          enabled={active && !alignMode && !isGizmoDragging}
          orbitRef={orbitRef}
          selectedObject={selectedObject}
          moveSpeed={speedPreset.move}
          verticalSpeed={speedPreset.vertical}
          onSpeedChange={onSpeedMulChange}
          forcePanOnRmb={editorMode === "layout"}
        />"""

if broken_str2 in text:
    text = text.replace(broken_str2, correct_str2)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print("Fixed via replace 2")
