# Make a Wish · 手势生日蛋糕

这是一个纯 HTML、CSS、JavaScript 的静态网页，不依赖 GPT 或任何聊天平台。

## 打开方式

- 在线分享：使用 GitHub Pages 发布后，把网页链接发给任何人即可。
- 本机预览：双击 `index.html` 可以查看并使用触控按钮。
- 摄像头手势：浏览器通常要求 HTTPS 或 localhost，因此推荐使用 GitHub Pages 链接测试。

## 手势顺序

1. ✊ 握拳：粒子聚合成双层蛋糕。
2. ✌️ 比耶手势：点亮代表 22 岁的两支数字“2”蜡烛。
3. 🖐️ 张开手掌：蛋糕散开并释放拍立得回忆。
4. 🤏 拇指与食指捏合：选中并放大照片。

手机和电脑均可以使用。摄像头不可用时，点击页面底部对应按钮也能完成全部流程。

## 替换照片

打开 `assets/photos` 文件夹，把照片依次重命名为：

```text
01.jpg
02.jpg
03.jpg
04.jpg
05.jpg
06.jpg
```

替换同名文件后刷新网页即可，不需要改 HTML。

照片下方的文字在 `config.js` 中修改。如果需要超过 6 张照片，继续添加 `07.jpg`、`08.jpg`，并在 `config.js` 的 `defaultPhotos` 中复制增加对应条目。

页面右上角的“选择照片”用于临时预览，刷新后会恢复为 `assets/photos` 文件夹内的照片。

## 建议的照片规格

- JPG 格式
- 单张小于 2 MB
- 竖图、横图均可，网页会自动居中裁切
- 建议至少准备 4 张，最多 16 张

## 修改标题和颜色

直接编辑 `config.js`：

- `title`：首页标题
- `age`：生日年龄（当前为 22）
- `name`：顶部小字
- `birthdayDate`：拍立得日期或祝福
- `cakeColors`：蛋糕、蜡烛与火焰颜色
- `caption`：每张照片下面的文字

## 依赖

网页通过公共 CDN 加载 Three.js 和 MediaPipe Hands。手势识别在浏览器中运行，网站本身没有服务器，也不会把照片上传到 GPT。

## 开源参考

本项目结合并改写了以下 MIT 开源项目中的成熟思路：

- [gesture-Christmas_tree-3d_with_photo](https://github.com/electronicminer/gesture-Christmas_tree-3d_with_photo)：手掌尺寸归一化、握拳/张开/捏合阈值与粒子状态切换。
- [gesture-particles](https://github.com/Wlarskog/gesture-particles)：手指闭合度计算、平滑与防抖思路。
- [happybirthday](https://github.com/patrick-paul/happybirthday)：生日仪式节奏、蜡烛和庆祝反馈参考。

详细版权说明见 `THIRD_PARTY_NOTICES.md`。
