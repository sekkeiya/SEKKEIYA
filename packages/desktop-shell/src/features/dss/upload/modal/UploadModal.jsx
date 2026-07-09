import React from 'react';
import { Modal } from '@mui/material';
import { useUploadModalContext } from '';
import UploadModalContent from './UploadModalContent';

const UploadModal = () => {
  const { modalOpen, closeModal } = useUploadModalContext();

  return (
    <Modal open={modalOpen} onClose={closeModal}>
      <UploadModalContent open={modalOpen} onClose={closeModal} />
    </Modal>
  );
};

export default UploadModal;
