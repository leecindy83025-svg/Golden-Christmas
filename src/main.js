import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import TWEEN from 'three/addons/libs/tween.module.js';

// Re-export or delegate to modules implemented in scene.js and gestures.js
import { createSceneObjects, calculateLayouts, startAnimation } from './scene.js';
import { initMediaPipe, enableCam, handleGesturesSetup } from './gestures.js';
import { handleImageUploadSetup } from './photos.js';

// Initialize scene
(async function(){
    // create DOM hooks
    const statusEl = document.getElementById('status');
    window.app = await createSceneObjects({ statusEl });

    calculateLayouts();

    // wire up UI
    document.getElementById('imageInput').addEventListener('change', handleImageUploadSetup.bind(null, window.app));
    document.getElementById('camBtn').addEventListener('click', () => enableCam(window.app));

    try {
        await initMediaPipe(window.app);
    } catch (err) {
        console.error('MediaPipe init failed:', err);
        document.getElementById('loading-text').innerText = 'AI init failed — continuing without camera';
    } finally {
        // hide loader regardless of success/failure so UI becomes interactive
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = 0;
            setTimeout(() => loader.style.display = 'none', 800);
        }
    }

    // start animation even if MediaPipe failed
    startAnimation(window.app);
})();
