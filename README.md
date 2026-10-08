# 狮小新 · 致新书院吉祥物

GitHub Pages 用户主页（https://haibarazzc.github.io/），内容是南方科技大学致新书院吉祥物「狮小新」的三维展示页。

- 三维模型与庭院场景源自 [zzcspace](https://zzcspace.com/portfolio/shizi/)（React Three Fiber + three.js，程序化建模，无外部模型文件）
- 依据 2018 年致新书院吉祥物六视图细化：连续圆瓣鬃毛、带独立嘴腔的脸部曲面、渐变额饰、弯曲尾穗、立体手掌与脚趾。保留原院徽图形，以曲面贴花贴合前胸。
- 默认以纯色展台和柔和接触阴影展示，可切换樱花庭院；支持三种姿态、局部观察、拖拽旋转与自动环绕。
- 推送到 `main` 自动构建并发布（GitHub Actions）

使用 Node.js 24（与发布工作流一致）。

```sh
npm install
npm run dev      # 本地开发
npm run check    # TypeScript 与模型拓扑检查
npm run build    # 构建 dist/
```

建模曲面位于 `src/shizi/lionGeometry.ts`，材质、院徽和关节动画位于 `src/shizi/LionModel.tsx`。`npm run check` 会检查八个主体曲面的顶点有效性、封闭接缝、面朝向、嘴部开口和面数预算。
