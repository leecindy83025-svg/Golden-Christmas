Golden Christmas — Gesture Interactive

Overview

A gesture-controlled interactive Christmas tree demo built with Three.js and MediaPipe. Switch between three main modes (Tree, Carousel, Chaos) and pinch to focus on photos. Designed to run as a static site for local preview or hosting.

Key Features

- Tree: particles form a tree with photos hanging on it
- Carousel: photos arranged in a circular gallery
- Chaos: floating/dispersed photos and particles
- Gesture controls (MediaPipe Hand Landmarker):
  - Fist or no hand → Tree
  - Victory (index + middle) → Chaos
  - Five fingers open → Carousel
  - Pinch (thumb + index) → Focus selected photo
- Photo upload: bulk upload, preserves aspect ratio

Project Structure

- index.html — entry page
- styles.css — styles
- src/
  - main.js — bootstrap
  - scene.js — scene, layouts, transitions
  - gestures.js — MediaPipe + gesture handling
  - photos.js — image upload and textures

Local Run (no Node required)

1. Ensure Python 3 is installed: python --version
2. Serve the folder from PowerShell:
   cd f:\project\ChristmasTree\webapp
   python -m http.server 8000
3. Open http://localhost:8000/

Important Notes

- The app must be served over HTTP(S) (file:// will not work) because MediaPipe loads WASM via HTTP(S).
- Camera access requires a secure context; localhost served via a static server typically works.
- If you see translate-pa.googleapis.com CORS/502 errors in the console, disable any automatic-translate browser extensions or test in an incognito window—the page includes a "notranslate" meta to reduce automatic translation triggers.

Troubleshooting

- Camera permission: ensure the browser allows camera access and no other app is using the camera.
- MediaPipe WASM: if loading fails, try refreshing or switching networks.
- Gesture responsiveness: test under good lighting; if gestures misbehave, capture console logs or a short video and open an issue.

If you want the repo published and need help preparing a GitHub Pages branch or polishing README, tell me which parts to include.
