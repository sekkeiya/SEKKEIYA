import React, { createContext, useContext, useMemo, useCallback, useState } from "react";

export const SelectedPageContext = createContext(null);

export const SelectedPageProvider = ({ children, initialPage = "dashboard" }) => {
  // 履歴スタック（末尾が現在ページ）
  const [history, setHistory] = useState([initialPage]);

  // 既存の public ボードIDはそのまま
  const [selectedBoardPublicId, setSelectedBoardPublicId] = useState(null);

  const selectedPage = history[history.length - 1] || initialPage;
  const prevPage = history.length > 1 ? history[history.length - 2] : null;
  const canGoBack = history.length > 1;

  // 既存API互換：同じページを連続で積まない
  const setSelectedPage = useCallback((nextPage) => {
    setHistory((h) => (h[h.length - 1] === nextPage ? h : [...h, nextPage]));
  }, []);

  // 1つ戻る
  const goBack = useCallback(() => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }, []);

  // 現在のページを置き換え（履歴を汚したくない遷移時に）
  const replacePage = useCallback((nextPage) => {
    setHistory((h) => (h.length ? [...h.slice(0, -1), nextPage] : [nextPage]));
  }, []);

  const value = useMemo(
    () => ({
      // 現在値
      selectedPage,
      prevPage,
      canGoBack,
      history,
      // 操作
      setSelectedPage,
      goBack,
      replacePage,
      // 既存フィールド
      selectedBoardPublicId,
      setSelectedBoardPublicId,
    }),
    [
      selectedPage,
      prevPage,
      canGoBack,
      history,
      setSelectedPage,
      goBack,
      replacePage,
      selectedBoardPublicId,
    ]
  );

  return <SelectedPageContext.Provider value={value}>{children}</SelectedPageContext.Provider>;
};

export const useSelectedPageContext = () => {
  const ctx = useContext(SelectedPageContext);
  if (!ctx) throw new Error("useSelectedPageContext must be used within SelectedPageProvider");
  return ctx;
};
