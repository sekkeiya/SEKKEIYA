import os

path = r"c:\Users\sekkeiya\02-WebApp\040-sekkeiya\sekkeiya-desktop\src\features\dsl\layout\canvas\viewports\SingleViewportCanvas.jsx"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

broken_str = """      <SectionClipManager />
        <PerspectiveCamera 
            makeDefault 
            fov={50} near={0.1} far={100000} 
            onUpdate={(c) => {
                console.log("[Canvas-PerspectiveCamera] activeCamUUID:", c.uuid);
                if (!c.userData.initialized) {
                    c.position.set(24, 18, 24);
                    // MMB/Pan orbit target center initialization
                    c.lookAt(0, 0, 0);
                    c.userData.initialized = true;
                }
            }} 
        />
      )}"""

correct_str = """      <SectionClipManager />

      <SmoothAlignFollower
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
            onUpdate={(c) => {
                console.log("[Canvas-PerspectiveCamera] activeCamUUID:", c.uuid);
                if (!c.userData.initialized) {
                    c.position.set(24, 18, 24);
                    // MMB/Pan orbit target center initialization
                    c.lookAt(0, 0, 0);
                    c.userData.initialized = true;
                }
            }} 
        />
      )}"""

if broken_str in text:
    text = text.replace(broken_str, correct_str)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print("Fixed via replace 1")
else:
    print("Could not find broken_str!")
