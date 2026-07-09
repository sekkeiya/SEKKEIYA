const minimalGLTF = "data:application/json;base64,eyJhc3NldCI6eyJ2ZXJzaW9uIjoiMi4wIn0sInNjZW5lcyI6W3sibm9kZXMiOltdfV0sInNjZW5lIjowLCJub2RlcyI6W119";

export const generateFurnitureModel = async (payload) => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  return {
    status: 'success',
    data: {
      resultGlbPath: minimalGLTF,
      resultPreviewImagePath: '',
      modelId: 'mock-furn-' + Date.now(),
    }
  };
};

export const generateArchitectureModel = async (payload) => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  return {
    status: 'success',
    data: {
      resultGlbPath: minimalGLTF,
      resultPreviewImagePath: '',
      modelId: 'mock-arch-' + Date.now(),
    }
  };
};

export const generateWithTripo = async (payload) => {
  await new Promise(resolve => setTimeout(resolve, 3000));
  return {
    status: 'success',
    data: {
      resultGlbPath: minimalGLTF,
      resultPreviewImagePath: '',
      modelId: 'mock-tripo-' + Date.now(),
    }
  };
};

export const mockGenerate = async (payload) => {
  const { engine } = payload;
  
  if (engine === 'self-furniture-v1') {
    return await generateFurnitureModel(payload);
  } else if (engine === 'self-architecture-v1') {
    return await generateArchitectureModel(payload);
  } else if (engine === 'tripo-api') {
    return await generateWithTripo(payload);
  } else {
    // Default fallback
    return await generateFurnitureModel(payload);
  }
};
