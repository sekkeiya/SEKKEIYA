export const getModelThumbUrl = (m = {}) =>
    m.thumbnailUrl ||
    m.thumbUrl ||
    m.thumbnailFile?.url ||
    m.thumbnailFilePath?.url ||
    "";