export const getAssetsFromDrive = async () => {
  return new Promise((resolve) => setTimeout(() => {
    resolve([
      { id: 'drive-1', type: 'image', title: 'Living Room Perspective', source: 'AI Drive', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=600&q=80', description: 'Generated interior view' },
      { id: 'drive-2', type: 'image', title: 'Office Floor Plan v2', source: 'AI Drive', url: 'https://images.unsplash.com/photo-1600607686527-6fb886090705?w=600&q=80', description: 'Top-down schematic' },
      { id: 'drive-3', type: 'image', title: 'Material Board (Wood)', source: 'AI Drive', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80', description: 'Finish references' },
    ]);
  }, 400));
};

export const getAssetsFrom3DSS = async () => {
  return new Promise((resolve) => setTimeout(() => {
    resolve([
      { id: '3dss-1', type: 'model', title: 'Nordic Lounge Chair', source: '3DSS', thumbnail: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&q=80', glbPath: '/mock/chair.glb' },
      { id: '3dss-2', type: 'model', title: 'Modern Sofa 3-Seater', source: '3DSS', thumbnail: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', glbPath: '/mock/sofa.glb' },
      { id: '3dss-3', type: 'model', title: 'Minimalist Dining Table', source: '3DSS', thumbnail: 'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?w=400&q=80', glbPath: '/mock/table.glb' },
    ]);
  }, 400));
};

export const getAssetsFrom3DSC = async () => {
  return new Promise((resolve) => setTimeout(() => {
    resolve([
      { id: '3dsc-1', type: 'model', title: 'Draft: Custom Chair A', source: '3DSC', thumbnail: 'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?w=400&q=80', glbPath: '/mock/chair_draft.glb' },
      { id: '3dsc-2', type: 'model', title: 'Draft: Reception Desk', source: '3DSC', thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80', glbPath: '/mock/desk_draft.glb' },
    ]);
  }, 400));
};

export const getUploadedAssets = async () => {
  return new Promise((resolve) => setTimeout(() => {
    resolve([
      { id: 'up-1', type: 'image', title: 'Site Photo 01', source: 'Upload', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80', description: 'Raw exterior photo' },
      { id: 'up-2', type: 'image', title: 'Client Logo', source: 'Upload', url: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=600&q=80', description: 'Transparent PNG' },
    ]);
  }, 400));
};
