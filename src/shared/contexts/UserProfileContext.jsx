import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { fetchUserProfileById } from "@/shared/utils/myPageUtils";

const UserProfileContext = createContext();

export const UserProfileProvider = ({ children }) => {
  const { user } = useAuth();
  const [userProfileImageUrl, setUserProfileImageUrl] = useState("");

  const refreshProfileImage = async () => {
    if (user?.uid) {
      const doc = await fetchUserProfileById(user.uid);
      setUserProfileImageUrl(doc?.profileImageUrl || user.photoURL || "");
    }
  };

  useEffect(() => {
    refreshProfileImage();
  }, [user]);

  return (
    <UserProfileContext.Provider value={{ userProfileImageUrl, refreshProfileImage }}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => useContext(UserProfileContext);
