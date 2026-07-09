// src/utils/urls/sekkeiyaUrls.js

const ORIGIN = import.meta.env.VITE_SEKKEIYA_ORIGIN || "https://sekkeiya.com";
const isDev = import.meta.env.DEV;

const enc = (v) => encodeURIComponent(v || "/");

const makeAbsoluteReturnTo = (path) => {
    if (!path || path === "/" || path === "%2F" || path === "/app/layout" || path === "/app/layout/") {
        path = isDev ? "/dashboard" : "/app/layout/dashboard";
    }
    // 相対パスの場合は現在のアプリのorigin (Devならlocalhost:5175など) を付与する
    if (path.startsWith("/")) {
        return window.location.origin + path;
    }
    return path;
};

export const toSekkeiyaLoginUrl = (returnTo) => {
    return `${ORIGIN}/login?return_to=${enc(makeAbsoluteReturnTo(returnTo))}`;
};

export const toSekkeiyaSignupUrl = (returnTo) => {
    return `${ORIGIN}/signup?return_to=${enc(makeAbsoluteReturnTo(returnTo))}`;
};

export const toSekkeiyaTopUrl = () => `${ORIGIN}/`;