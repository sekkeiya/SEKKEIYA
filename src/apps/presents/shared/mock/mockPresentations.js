export const initialMockPresentations = [
  { 
    id: 'pres-1', 
    title: 'Meguro Residence Proposal', 
    description: 'Residential complex proposal for Meguro project.', 
    updatedAt: '2026-03-18T10:00:00Z', 
    author: 'T. Sekkeiya', 
    ownerId: 'user-1',
    visibility: 'public',
    type: 'proposal',
    boardId: null,
    teamId: null,
    thumbnail: null,
    pages: [
      { 
        id: 'pg-1-1', 
        name: 'Cover', 
        elements: [
          { id: 'el-1', type: 'image', x: 0, y: 0, w: '100%', h: '100%', data: { src: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80' } },
          { id: 'el-2', type: 'title', x: '10%', y: '40%', w: '80%', h: 'auto', data: { text: 'MEGURO RESIDENCE PROPOSAL', fontSize: '48px', color: '#fff', fontWeight: 'bold' } },
          { id: 'el-3', type: 'text', x: '10%', y: '52%', w: '80%', h: 'auto', data: { text: 'SEKKEIYA Architects', fontSize: '24px', color: '#eaeaea' } }
        ] 
      },
      { 
        id: 'pg-1-2', 
        name: 'Concept Layout', 
        elements: [
          { id: 'el-4', type: 'title', x: '5%', y: '10%', w: '40%', h: 'auto', data: { text: 'Interior Concept', fontSize: '36px', color: '#111', fontWeight: 'bold' } },
          { id: 'el-5', type: 'text', x: '5%', y: '25%', w: '40%', h: 'auto', data: { text: 'A design focusing on natural light and seamless indoor-outdoor transitions.', fontSize: '18px', color: '#444' } },
          { id: 'el-6', type: 'image', x: '50%', y: '10%', w: '45%', h: '80%', data: { src: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' } }
        ] 
      }
    ]
  },
  { 
    id: 'pres-2', 
    title: 'Retail Store Concept', 
    description: 'Interactive presentation for the new flagship store.', 
    updatedAt: '2026-03-17T15:30:00Z', 
    author: 'AI Drive', 
    ownerId: 'user-2',
    visibility: 'public',
    type: 'competition',
    boardId: 'board-1',
    teamId: 'team-alpha',
    thumbnail: null,
    pages: [
      { 
        id: 'pg-2-1', 
        name: 'Store Front', 
        elements: [
          { id: 'el-7', type: 'title', x: '0', y: '40%', w: '100%', h: 'auto', data: { text: 'Flagship Retail Concept', fontSize: '48px', color: '#222', textAlign: 'center' } }
        ] 
      }
    ]
  },
  { id: 'pres-3', title: 'Office Space Renovation', description: 'Interactive architectural proposal.', updatedAt: '2026-03-15T09:20:00Z', author: 'T. Sekkeiya', ownerId: 'user-1', visibility: 'private', type: 'proposal', boardId: null, teamId: null, thumbnail: null, pages: [] },
  { id: 'pres-4', title: 'Living Room Remodel', description: 'Concept layout using 3D assets.', updatedAt: '2026-03-14T11:45:00Z', author: 'Design Team', ownerId: 'user-3', visibility: 'public', type: 'material', boardId: 'board-2', teamId: null, thumbnail: null, pages: [] },
  { id: 'pres-5', title: 'Annual Sustainable Report', description: '2025 Retrospective presentation.', updatedAt: '2026-03-10T14:10:00Z', author: 'Sustainability', ownerId: 'user-1', visibility: 'private', type: 'report', boardId: null, teamId: null, thumbnail: null, pages: [] },
  { id: 'pres-6', title: 'Furniture Collection 2026', description: 'Catalog presentation for upcoming models.', updatedAt: '2026-03-08T16:00:00Z', author: 'Product', ownerId: 'user-1', visibility: 'public', type: 'product', boardId: null, teamId: 'team-design', thumbnail: null, pages: [] },
];
