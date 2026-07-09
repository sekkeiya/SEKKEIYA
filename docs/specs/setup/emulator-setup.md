# Firebase Emulator 環境構築と起動手順

本プロジェクトで Cloud Functions や Firestore の検証を行うためには、ローカルで Firebase Emulator を動作させる必要があります。
これにより、課金を発生させずに安全かつスピーディにテストが可能です。

## 1. 必須前提環境（Requirements）

Emulator（特にFirestoreEmulator）を起動させるためには、以下の環境が必要です。

1. **Java (必須)**
   - バージョン: **OpenJDK 17 または 21** 推奨 (最低 Java 11 以上)
   - Firestore Emulator 等を動かすための基盤としてJava稼働環境 (JRE/JDK) が要求されます。
   - インストール後、ターミナルで `java -version` が正しく認識されること（環境変数 `PATH` に通っていること）を確認してください。

2. **Node.js**
   - バージョン: **v18 または v20 または v22** 推奨 (Cloud Functions v2 のランタイムと合わせる)

3. **Firebase CLI**
   - バージョン: **最新版推奨 (v13.x 系以上)**
   - `npm install -g firebase-tools` でグローバルインストールしておくこと。

---

## 2. Emulator の起動手順

開発時のターミナルから、以下の手順でエミュレータ全体を起動します。

### 実行ディレクトリ
親アプリケーションである **`sekkeiya` のルートディレクトリ**

```bash
cd /path/to/sekkeiya
```

### 起動コマンド
package.json に定義されたスクリプトを利用します。

```bash
npm run emulators
```

*(内部的には `firebase emulators:start --only auth,firestore,functions,storage` が実行されています。)*

### 起動確認
コマンド実行後、ターミナルに以下のような `Emulator UI` の URL が表示されれば成功です。
ブラウザからアクセスして、データや関数のログを確認できます。

```text
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ Emulator UI viewing: http://127.0.0.1:4000                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. アプリの検証（API駆動のテスト）

1. Emulator が起動した状態のターミナルをそのままにしておく
2. **別のターミナル** を開き、各アプリ（sekkeiya, r3dm-share(Storybook等)）の開発サーバーを起動する (`npm run dev`)
3. フロントエンド上の操作（今回の例：アップロードモーダルからの3Dモデルアップロード）を実行
4. **Emulator を起動したターミナルのログ**（または Emulator UI の Logs タブ）に、該当の Callable関数（`processModelUpload`）が実行された履歴が表示されることを確認してください。
