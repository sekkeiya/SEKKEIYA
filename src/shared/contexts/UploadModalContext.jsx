// contexts/UploadModalContext.js
import { createContext, useContext, useState } from "react";

// Context 作成
const UploadModalContext = createContext();

// Provider コンポーネント
export const UploadModalProvider = ({ children }) => {
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  return (
    <UploadModalContext.Provider value={{ modalOpen, openModal, closeModal }}>
      {children}
    </UploadModalContext.Provider>
  );
};

// カスタムフックで Context を提供
export const useUploadModalContext = () => {
  const context = useContext(UploadModalContext);
  if (!context) {
    throw new Error("useUploadModalContext must be used within UploadModalProvider");
  }
  return context;
};
