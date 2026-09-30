# 便知

移动端优先的排便健康记录 H5 / PWA。支持本机体验，也支持通过 Supabase 账户在多设备安全同步。

在线体验：[https://imwangl.github.io/bianzhi-health/](https://imwangl.github.io/bianzhi-health/)

## 已实现

- 拍照或选择照片，并在本机压缩、初步识别颜色
- 按布里斯托 1–7 型、颜色、排便感受和伴随症状记录
- 可解释的状态评分与红旗症状提示
- 7 日频次、形态稳定度和状态趋势
- 历史记录、详情、本地数据导出和清除
- PWA 清单及离线缓存，可从浏览器添加到主屏幕
- 邮箱注册登录、云端同步、数据库 RLS 用户数据隔离

## 本地运行

```bash
npm install
npm run dev
```

复制 `.env.example` 为 `.env.local`，填入 Supabase Project URL 和 anon key，即可启用登录。

首次配置 Supabase 时，在 SQL Editor 执行 [`supabase/schema.sql`](supabase/schema.sql)。该脚本会创建记录表、私有照片桶和用户隔离策略。

生产构建：

```bash
npm run build
```

## 边界

当前照片识别是浏览器端的轻量颜色采样，形态需要用户确认。结果用于日常健康记录，不构成医疗诊断。

## GitHub Pages

仓库包含 `.github/workflows/deploy.yml`。在仓库 Secrets 中配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`，并将 Pages Source 设为 GitHub Actions，推送 `main` 后会自动发布。
