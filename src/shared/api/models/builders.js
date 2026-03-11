// utils/services/models/crud/builders.js

// users/{userId} のプロフィールドから handle を取得（厳密に一致させる）
const pickHandleFromProfile = (profile = {}) => {
    // まずは正規フィールドを優先
    if (profile.handle) return String(profile.handle);
    // 互換：小文字版を持っている場合
    if (profile.handleLower) return String(profile.handleLower);
    // ここで無理に派生はしない（「同一にする」要件のため）
    return null;
};

export const buildModelData = ({
    title,
    description,
    thumbnailFilePath,
    selectedCategory,
    selectedUsage,
    mainCategory,
    subCategory,
    detailCategory,
    type,
    subType,
    size,
    // brands,
    user,          // Firebase Auth のユーザー（uid 等）
    userProfile,   // ★ 追加: users/{userId} ドキュメントの中身を渡す
    visibility,
    files,
    price,
}) => {
    const handle = pickHandleFromProfile(userProfile); // ← プロフィールの値をそのまま採用
    const authorName =
        (userProfile && (userProfile.displayName || userProfile.name)) ||
        user?.displayName ||
        "匿名ユーザー";

    return {
        title: title || "",
        description: description || "",
        thumbnailFilePath: thumbnailFilePath || null,

        category: selectedCategory || null,
        usage: selectedUsage || null,
        mainCategory: mainCategory || null,
        subCategory: subCategory || null,
        detailCategory: detailCategory || null,
        type: type || null,
        subType: subType || null,

        size: size
            ? {
                width: size.width || "",
                depth: size.depth || "",
                height: size.height || "",
                sh: size.sh || "",
            }
            : null,

        // brands: brands || [],
        files: files || {},
        price: price || "",

        createdBy: user?.uid || null,
        author: authorName,

        // ★ 追加: users/{userId} と同じ handle / handleLower を保存
        handle: handle,
        handleLower: handle ? handle.toLowerCase() : null,

        visibility: visibility || null,
        createdAt: new Date(),
    };
};
