import { ALIAS_DICT } from "../constants/CategoryAliasDict";
import { tokenizeFilename } from './fileMetadataExtractor';

// 2. 類似度スコア算出
export const scoreSimilarModel = (newFileInfo, existingModel) => {
  let score = 0;
  let scoreDetails = [];

  // Token Match (Filename/Folder tokens vs Existing Title/Tags)
  const newTokens = newFileInfo.tokens || [];
  const existingTitleTokens = tokenizeFilename(existingModel.title || existingModel.name || '');
  const existingTags = existingModel.tags || [];
  const existingTokens = new Set([...existingTitleTokens, ...existingTags.map(t => t.toLowerCase())]);

  let tokenMatchCount = 0;
  newTokens.forEach(token => {
    if (existingTokens.has(token)) {
      tokenMatchCount++;
      // Give high weight to token matches
      score += 15;
    }
  });

  if (tokenMatchCount > 0) {
    scoreDetails.push(`Token Match (+${tokenMatchCount * 15})`);
  }

  // Extension Match
  if (newFileInfo.ext && existingModel.ext && newFileInfo.ext.toLowerCase() === existingModel.ext.toLowerCase()) {
    score += 5;
    scoreDetails.push('Ext Match (+5)');
  }

  // Dimensions Proximity (Auxiliary, within 15% volume diff)
  if (newFileInfo.dimensions && existingModel.dimensions) {
    const n = newFileInfo.dimensions;
    const e = existingModel.dimensions;
    if (n.width > 0 && e.width > 0) {
      const volN = n.width * n.depth * n.height;
      const volE = e.width * e.depth * e.height;
      if (volN > 0 && volE > 0) {
        const ratio = Math.min(volN, volE) / Math.max(volN, volE);
        if (ratio > 0.85) {
          score += 10;
          scoreDetails.push(`Dim Similar (+10)`);
        }
      }
    }
  }

  return { score, scoreDetails };
};

// 1. 類似モデル検索 (Top N)
export const findSimilarExistingModels = (newFile, existingModels, topN = 5) => {
  if (!existingModels || existingModels.length === 0) return [];

  const pathParts = newFile.webkitRelativePath ? newFile.webkitRelativePath.split(/[\/\\]/) : [];
  const folders = pathParts.slice(0, -1);
  const rawString = [...folders, newFile.name].join(' ');
  const tokens = tokenizeFilename(rawString);
  const ext = newFile.name.split('.').pop() || '';
  
  const newFileInfo = {
    tokens,
    ext,
    // uploadModal dimensions might be attached directly to the 'item' object rather than the standard file
    dimensions: newFile.dimensions || null 
  };

  const scoredModels = existingModels.map(model => {
    const { score, scoreDetails } = scoreSimilarModel(newFileInfo, model);
    return { 
      id: model.id || model.assetId || Math.random().toString(36).substring(7),
      title: model.title || model.name,
      type: model.type,
      mainCategory: model.mainCategory,
      subCategory: model.subCategory,
      detailCategory: "",
      tags: model.tags,
      _similarityScore: score, 
      _scoreDetails: scoreDetails 
    };
  });

  // Filter out 0 score to avoid noise
  const relevant = scoredModels.filter(m => m._similarityScore > 0);
  relevant.sort((a, b) => b._similarityScore - a._similarityScore);

  return relevant.slice(0, topN);
};

// 3. カテゴリ補完候補の集計 (スコアベース)
export const aggregateCategoryCandidatesFromSimilarModels = (topModels) => {
  const candidatesMap = new Map();
  let maxScore = 0;
  let furnitureScore = 0;
  let buildingScore = 0;
  
  topModels.forEach(model => {
    if (!model.mainCategory) return;
    const path = [model.type || "", model.mainCategory || "", model.subCategory || ""].join('|');
    const existing = candidatesMap.get(path) || {
      type: model.type || "",
      mainCategory: model.mainCategory || "",
      subCategory: model.subCategory || "",
      detailCategory: "",
      score: 0,
      frequency: 0
    };
    existing.score += model._similarityScore;
    existing.frequency += 1;
    
    // Accumulate total scores per type
    if (model.type === "家具") furnitureScore += model._similarityScore;
    if (model.type === "建築") buildingScore += model._similarityScore;
    
    if (existing.score > maxScore) {
      maxScore = existing.score;
    }
    
    candidatesMap.set(path, existing);
  });

  const candidatesList = Array.from(candidatesMap.values());
  // Sort by score descending
  candidatesList.sort((a, b) => b.score - a.score);

  return { maxScore, furnitureScore, buildingScore, candidates: candidatesList };
};

// 4. タグ補完候補の集計 (スコアベース)
export const aggregateTagCandidatesFromSimilarModels = (topModels) => {
  const tagsMap = new Map();
  
  topModels.forEach(model => {
    if (!model.tags || !Array.isArray(model.tags)) return;
    model.tags.forEach(tag => {
      const lowerTag = tag.trim().toLowerCase();
      if (!lowerTag) return;
      const currentScore = tagsMap.get(lowerTag) || 0;
      tagsMap.set(lowerTag, currentScore + model._similarityScore);
    });
  });

  const tagsList = Array.from(tagsMap.entries()).map(([tag, score]) => ({ tag, score }));
  // Sort by score descending
  tagsList.sort((a, b) => b.score - a.score);
  
  // Deduplicate and sanitize
  return tagsList.map(t => t.tag);
};
