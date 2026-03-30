# AI 股票分析 · Cloudflare 稳态版

## 目录结构
- `index.html` 前端页面
- `functions/api/quote.js` Cloudflare Pages Function

## 为什么这版更稳
- 不再让浏览器直接请求第三方代理
- 数据请求走你自己的 `/api/quote`
- Cloudflare 边缘缓存 5 分钟
- 前端本地也会缓存同一轮查询

## 部署（最简单）
1. 把整个文件夹上传到 GitHub 仓库根目录
2. 登录 Cloudflare
3. Workers & Pages → Create application → Pages → Import an existing Git repository
4. 选择你的仓库
5. Build command 留空
6. Build output directory 留空或 `/`
7. 部署

## 注意
- 当前版本优先支持美股七巨头
- 数据源是免费日线源，重点是稳定，不是毫秒级实时
- 如果以后要更强稳定性，可把 `functions/api/quote.js` 改成接付费 API（Polygon / Twelve Data / Alpha Vantage）
