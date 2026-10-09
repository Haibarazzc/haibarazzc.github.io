# 狮小新 · 致新书院吉祥物

南方科技大学致新书院吉祥物「狮小新」的三维展示页（https://haibarazzc.github.io/）。

- React Three Fiber + three.js，使用提供的「狮小新_30k.obj」原型
- 网页加载约 704 KiB 的索引 GLB，保留 14,994 个顶点与 29,988 个三角面；比原 OBJ 小约 33%
- 转换时校正 Z-up 朝向与比例，局部平滑脸部，补充统一暖橙 / 奶白配色、圆眼高光、鼻头、牙齿、粉舌与胸口院徽
- 模型含原始底座，没有骨骼动画；静立 / 暖阳切换光照，回望切到侧面镜头
- 推送到 `main` 自动构建并发布（GitHub Actions）

```sh
npm install
npm run dev      # 本地开发
npm run typecheck # TypeScript 检查
npm run build    # 构建 dist/
```

原始文件保存在 `assets/models/shixiaoxin-30k.obj`，展示文件为 `public/models/shixiaoxin-30k.glb`。原文件没有贴图，网页的配色与表情材质是展示补充。修改原型或配色后运行 `npm run model:convert` 重新生成 GLB；常规构建直接使用已经生成的模型。
