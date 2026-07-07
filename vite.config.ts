import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 相対パス出力(GitHub Pages のプロジェクトサイト配下でも動くように)
  base: "./",
  // プレビュー環境から PORT が渡された場合はそれを使う
  server: { port: Number(process.env.PORT) || 5183 },
  build: {
    // この環境では esbuild の minify プロセスが不安定なため terser を使う
    minify: "terser",
    // ライブラリを分割してチャンク肥大を防ぐ
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
