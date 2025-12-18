## Golden Christmas — Gesture Interactive

#### 项目简介

这是一个基于 Three.js 与 MediaPipe 的交互式圣诞树演示。通过手势控制，可以在三种主要场景间切换（收缩态，中间态和照片旋转态），在照片旋转态可捏合选中照片进入放大（Focus）。项目适合集成到静态站点，便于本地预览与发布。
参考图片：
<img width="1920" height="910" alt="image" src="https://github.com/user-attachments/assets/d1d51798-6e2f-4974-ac19-33265bf5ca69" />

<img width="1920" height="910" alt="image" src="https://github.com/user-attachments/assets/74090c52-8ee1-4e02-8bd0-0d0543d81d5e" />

#### 主要功能

- 三个场景：
  - Tree：粒子收拢成圣诞树，照片挂在树上
  - Carousel：照片围成环状可浏览
  - Chaos：粒子与照片在空间中漂浮
- 手势控制（MediaPipe Hand Landmarker）：
  - 握拳或无手 → 返回 Tree 模式
  - 食指+中指（耶手势）→ Chaos 模式
  - 张开五指 → Carousel 模式
  - 捏合（拇指+食指靠近）→ 选中离相机最近的照片并进入 Focus（放大）
- 照片上传：支持上传文件夹，所有照片放在文件夹中，自动替换占位图片并保持宽高比
- 视觉特效：泛光（Unreal Bloom）、粒子光晕、下雪效果

#### 本地运行（无需 Node）

1. 确保已安装 Python 3：
  ```python
  python --version
  ```
2. 在 PowerShell 中运行：

   cd 到项目文件夹
   ```python
   python -m http.server 8000
   ```
3. 打开浏览器并访问：
   http://localhost:8000/

#### 项目结构

- index.html          — 页面入口
- styles.css          — 样式
- src/
  - main.js           — 启动与模块连接
  - scene.js          — 场景构建、布局与动画
  - gestures.js       — MediaPipe 初始化与手势逻辑
  - photos.js         — 图片上传与纹理处理



#### 重要说明

- 请通过 HTTP(S) 访问页面（不能直接用 file:// 打开），因为 MediaPipe 的 WASM 模块需通过 HTTP(S) 加载。
- 使用摄像头需要安全上下文；在 localhost 上通过静态服务器运行通常允许摄像头权限。
- 如果页面一直停在 Loading：在浏览器控制台查看错误信息；常见原因包括网络阻断或扩展干扰（如自动翻译扩展）。
- 如果看到 translate-pa.googleapis.com 的 CORS/502 错误，请在浏览器中禁用自动翻译扩展或在隐身窗口测试；页面已添加不翻译 meta，以降低触发概率。

#### 调试提示

- 摄像头权限：检查浏览器是否允许摄像头访问并且没有被其他应用占用。
- MediaPipe WASM：若加载失败，尝试刷新或更换网络环境。

