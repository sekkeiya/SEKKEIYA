import React from 'react';
import { Box, Typography } from '@mui/material';
import UploadQueueItemCard from './UploadQueueItemCard';
import DropZone from './DropZone';

const UploadQueueList = ({ uploadQueue, setters, onDropFiles }) => {
  return (
    <Box sx={{ width: '100%' }}>
      {uploadQueue.length === 0 ? (
        <DropZone
          label="3Dモデルファイルをドロップ（.glb / .3dm / .blend / .gh / .obj など複数可）"
          onDrop={onDropFiles}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 追加ファイルのドロップゾーン（小さめ） */}
          <DropZone
            label="さらにファイルを追加（ドロップ）"
            onDrop={onDropFiles}
            isCompact={true}
          />
          
          {/* アップロードキューの全アイテムをリスト表示 */}
          {uploadQueue.map((item, index) => (
            <UploadQueueItemCard
              key={item.id}
              item={item}
              setters={setters}
              index={index}
              total={uploadQueue.length}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default UploadQueueList;
