import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blogVideo: {
      /** 動画ノードを挿入する */
      setBlogVideo: (options: { src: string }) => ReturnType;
    };
  }
}

/**
 * 本文に動画を埋め込むための TipTap ノード。
 * Markdown には標準の動画記法が無いため、生 HTML の <video> タグとして
 * 直列化／復元する（tiptap-markdown を html:true で使う前提）。
 * 公開サイト側の Markdown レンダラでは raw HTML を許可することで再生できる。
 */
export const BlogVideo = Node.create({
  name: 'blogVideo',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
    };
  },

  parseHTML() {
    return [{ tag: 'video[src]' }, { tag: 'video source[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: 'true',
        playsinline: 'true',
        preload: 'metadata',
        style: 'max-width:100%;border-radius:8px;',
      }),
    ];
  },

  addCommands() {
    return {
      setBlogVideo:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src: options.src } }),
    };
  },

  addStorage() {
    return {
      markdown: {
        // 生 HTML として書き出す（前後に空行を入れてブロック扱いにする）
        serialize(state: any, node: any) {
          const src = node.attrs.src || '';
          state.write(`<video src="${src}" controls></video>`);
          state.closeBlock(node);
        },
        parse: {}, // html:true 経由で parseHTML が復元を担当する
      },
    };
  },
});
