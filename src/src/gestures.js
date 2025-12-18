import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { transitionTo, getNearestPhotoIndex, setHandActive, getCurrentState, calculateLayouts, quickResetToTree, setMorphSpeed } from './scene.js';

let handLandmarker = undefined;
let webcamRunning = false;
let lastVideoTime = -1;

export async function initMediaPipe(app){
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
    document.getElementById('loading-text').innerText = "Ready!";
}

export async function enableCam(app){
    if(!handLandmarker) return;
    webcamRunning = true;
    document.getElementById('camBtn').style.display = 'none';
    document.getElementById('webcam-container').style.display = 'block';
    const video = document.getElementById('webcam');
    try{
        video.srcObject = await navigator.mediaDevices.getUserMedia({ video:true });
        video.addEventListener('loadeddata', () => predictWebcam(app, video));
    }catch(err){ alert('Camera Error'); }
}

function predictWebcam(app, video){
    if(!handLandmarker){
        // handLandmarker not ready yet, try again next frame
        if(webcamRunning) window.requestAnimationFrame(() => predictWebcam(app, video));
        return;
    }
    if(lastVideoTime !== video.currentTime){
        const now = performance.now();
        // lower throttle to be more responsive but protect CPU
        if(now - lastVideoTime > 20){
            lastVideoTime = now;
            let results;
            try{ results = handLandmarker.detectForVideo(video, now); }catch(e){ console.warn('HandLandmarker detect error', e); results = { landmarks: [] }; }
            handleGestures(app, results);
        }
    }
    if(webcamRunning) window.requestAnimationFrame(() => predictWebcam(app, video));
}

function handleGestures(app, results){
    // 1. NO HAND DETECTED -> FORCE TREE & LEVEL SCENE (fast)
    if(!results.landmarks || results.landmarks.length === 0){
        setHandActive(false);
        try{
            // Temporarily speed up morphing for quick visual snap back
            setMorphSpeed(0.2);
            // Ensure we transition to the tree layout (fast) so photos go back to ribbon positions
            transitionTo('tree', -1, true);
            // after brief moment, restore morph speed
            setTimeout(()=>{ setMorphSpeed(0.03); }, 300);
        } catch(e){ console.warn('Quick reset failed', e); }

        if (app && app.controls) app.controls.autoRotate = true;
        if (app && app.statusEl) app.statusEl.innerText = 'Mode: TREE FORM';
        return;
    }

    // restore normal morph speed when hand present
    setMorphSpeed(0.03);

    setHandActive(true);
    if (app && app.controls) app.controls.autoRotate = false;

    const lm = results.landmarks[0];
    const dist = (i, j) => Math.hypot(lm[i].x - lm[j].x, lm[i].y - lm[j].y);
    const isFingerOpen = (tip, pip, wrist) => dist(tip, wrist) > dist(pip, wrist);

    const handX = lm[0].x; const handY = lm[0].y;
    const thumbOpen = dist(4,0) > 0.28;
    const indexOpen = isFingerOpen(8,6,0);
    const middleOpen = isFingerOpen(12,10,0);
    const ringOpen = isFingerOpen(16,14,0);
    const pinkyOpen = isFingerOpen(20,18,0);

    const openCount = [thumbOpen, indexOpen, middleOpen, ringOpen, pinkyOpen].filter(Boolean).length;

    // Pinch detection: thumb-index distance
    const pinchDist = dist(4,8);

    // debounce state
    if(typeof handleGestures._lastActionTime === 'undefined') handleGestures._lastActionTime = 0;
    const now = performance.now();
    if(now - handleGestures._lastActionTime < 250) {
        // throttle actions to 250ms
    }

    // --- SCENE ROTATION
    if (app && app.scene && ['tree','carousel','chaos'].includes(getCurrentState())){
        const targetRotY = (handX - 0.5) * 8.0;
        app.scene.rotation.y += (targetRotY - app.scene.rotation.y) * 0.08;
        let targetRotX = 0;
        if(getCurrentState() === 'tree') targetRotX = (handY - 0.5) * 1.5;
        else if(getCurrentState() === 'chaos') targetRotX = (handY - 0.5) * 8.0;
        app.scene.rotation.x += (targetRotX - app.scene.rotation.x) * 0.08;
    }

    // --- STATE SWITCHING
    if(getCurrentState() === 'focus'){
        if(openCount >= 4) { transitionTo('carousel'); handleGestures._lastActionTime = now; }
        else if(openCount <= 1) { transitionTo('tree'); handleGestures._lastActionTime = now; }
        return;
    }

    const isVictory = indexOpen && middleOpen && !ringOpen && !pinkyOpen;

    if(isVictory){
        if(getCurrentState() !== 'chaos') { transitionTo('chaos'); handleGestures._lastActionTime = now; }
    }
    else if(openCount <= 1){
        if(getCurrentState() !== 'tree') { transitionTo('tree'); handleGestures._lastActionTime = now; }
    }
    else if(openCount >= 4){
        if(getCurrentState() !== 'carousel') { transitionTo('carousel'); handleGestures._lastActionTime = now; }
    }
    else if(pinchDist < 0.05){
        if((getCurrentState() === 'carousel' || getCurrentState() === 'chaos') && now - handleGestures._lastActionTime > 400){
            const nearestIdx = getNearestPhotoIndex();
            if(nearestIdx !== -1) { transitionTo('focus', nearestIdx); handleGestures._lastActionTime = now; }
        }
    }
}

export function handleGesturesSetup(){ /* placeholder */ }
