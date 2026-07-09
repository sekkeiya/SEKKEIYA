/**
 * Generates an array of tags based on the filename, category, and type.
 * Cleans up extensions, versions, stop words, and arbitrary UUIDs.
 * 
 * @param {string} filename Original filename
 * @param {string} category 
 * @param {string} type 
 * @returns {string[]} Array of tags
 */
export const generateTagsFromMetadata = (filename = '', category = '', type = '') => {
  const tags = new Set();

  if (category) tags.add(category);
  if (type) tags.add(type);

  // 1. Remove extension
  let baseName = filename.replace(/\.[^/.]+$/, '');

  // 2. Remove UUIDs, strict versionings, common noise words
  // Remove UUID roughly looking like 8-4-4-4-12
  baseName = baseName.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig, ' ');
  
  // 3. Split by common delimiters (underscore, hyphen, space, periods)
  // and handle camelCase to SpaceCase conversion temporarily
  const splitString = baseName
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase split
    .split(/[-_.\s]+/); // split by delimiters

  const stopWords = new Set([
     'final', 'test', 'copy', 'v1', 'v2', 'v3', 'v4', 'v5', 'new', 'old', 'asset', 'model', 'mesh'
  ]);

  splitString.forEach(token => {
    const cleanToken = token.trim().toLowerCase();
    
    if (!cleanToken || cleanToken.length <= 1) return; // skip very short tokens
    if (stopWords.has(cleanToken)) return; // skip stop words
    if (/^\d+$/.test(cleanToken)) return; // skip pure numbers
    
    // Add original cased token if it passes validation
    tags.add(token.trim());
  });

  return Array.from(tags).slice(0, 10); // Limit to reasonable amount
};
