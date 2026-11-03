# Chao · Chen Hao Portfolio

产品设计师 Chen Hao 的个人作品集网站，包含主页、作品目录、个人介绍、联系页和四个完整项目。

## 本地运行

```bash
python3 serve-editable.py --port 8765
```

打开 http://127.0.0.1:8765/ 。可视化编辑器位于 http://127.0.0.1:8765/editor.html 。

也可以仅预览静态文件：

```bash
python3 -m http.server 8765 --directory dist
```

静态预览不提供本地编辑服务的保存接口。

## 文件结构

- `dist/`：可直接编辑的 HTML、CSS、JavaScript，以及网站使用的图片、字体、说明书 PDF 和编辑器。
- `serve-editable.py`：本地预览与编辑保存服务。
- `dist/site-files.json`：编辑器导出网站所需的文件清单。

## 作品

1. Urban Respite Initiative
2. Plastic Eternity
3. Azure Clean
4. The Armor of Form

## 部署

网站为无构建步骤的静态网站，静态托管的发布目录为 `dist/`。当前仓库用于同步代码，未自动开启 GitHub Pages 或其他线上部署。

本地缓存、旧备份、Sites 本地配置和原始素材工作目录不纳入同步。网页图文和参考素材的权利归各自权利人所有；上传本仓库不额外授予复用许可。
