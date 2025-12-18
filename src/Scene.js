import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import TWEEN from 'three/addons/libs/tween.module.js';

const CONFIG = {
    colors: {
        deepGreen: 0x003311,
        brightGreen: 0x20FF55,
        gold: 0xFFD700,
        ribbonRed: 0xFF3333,
        ribbonGold: 0xFFD700,
        ribbonBlue: 0x3388FF,
        ribbonPurple: 0x9933FF,
        ribbonCyan: 0x00FFFF,
        starYellow: 0xFFE066,
        snow: 0xFFFFFF
    },
    treeParticleCount: 7000,
    bgParticleCount: 3000,
    snowCount: 2000,
    photoCount: 12,
    ribbonCount: 600
};

let scene, camera, renderer, composer, controls;
let photosGroup = new THREE.Group();
let treePoints, bgPoints, snowPoints, starMesh, ribbonMesh;
let photos = [];
let topLight;

let handLandmarker = undefined; // reserved
let webcamRunning = false;
let lastVideoTime = -1;
let currentState = 'tree';
let currentFocusIndex = -1;
let morphSpeed = 0.03;
let isHandActive = false;

const targets = { tree:{}, carousel:{}, chaos:{}, focus:{} };
const dummy = new THREE.Object3D();

export async function createSceneObjects({ statusEl }){
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000500, 0.0008);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.set(0,50,650);

    renderer = new THREE.WebGLRenderer({ antialias:false, alpha:true, powerPreference:"high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.autoRotate = true; controls.autoRotateSpeed = 0.8;

    const renderScene = new (await import('three/addons/postprocessing/RenderPass.js')).RenderPass(scene, camera);
    const UnrealBloomPass = (await import('three/addons/postprocessing/UnrealBloomPass.js')).UnrealBloomPass;
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.85; bloomPass.strength = 0.8; bloomPass.radius = 0.5;

    composer = new (await import('three/addons/postprocessing/EffectComposer.js')).EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); scene.add(ambientLight);
    topLight = new THREE.PointLight(CONFIG.colors.gold, 0.5, 1200); topLight.position.set(0,450,0); scene.add(topLight);

    // Create world objects
    createObjects();
    calculateLayouts();

    // Apply initial layout
    try { transitionTo('tree'); } catch(e) { /* ignore if transition unavailable during early init */ }

    window.addEventListener('resize', onWindowResize);

    // return app state
    // expose TWEEN to global so other modules can access for safety
    if (typeof window !== 'undefined') window.TWEEN = TWEEN;
    return { scene, camera, renderer, composer, controls, photosGroup, photos, targets, CONFIG, statusEl, THREE, transitionTo, getNearestPhotoIndex, getCurrentState, setHandActive };
}

function createObjects(){
    // A. Tree Particles
    const treeGeo = new THREE.BufferGeometry();
    const treePos = []; const treeCols = []; const colHelper = new THREE.Color();
    for(let i=0;i<CONFIG.treeParticleCount;i++){
        treePos.push(0,0,0);
        const rand = Math.random();
        if(rand > 0.75){
            if(Math.random()>0.5) colHelper.setHex(CONFIG.colors.gold);
            else colHelper.setHex(0xFFF7C6);
        } else if(rand > 0.4) colHelper.setHex(CONFIG.colors.brightGreen);
        else colHelper.setHex(CONFIG.colors.deepGreen);
        treeCols.push(colHelper.r, colHelper.g, colHelper.b);
    }
    treeGeo.setAttribute('position', new THREE.Float32BufferAttribute(treePos, 3));
    treeGeo.setAttribute('color', new THREE.Float32BufferAttribute(treeCols, 3));
    const treeMat = new THREE.PointsMaterial({ size:6.0, vertexColors:true, blending:THREE.AdditiveBlending, transparent:true, opacity:0.9, map:createGlowTexture(), depthWrite:false });
    treePoints = new THREE.Points(treeGeo, treeMat); scene.add(treePoints);

    // B. Background Stars
    const bgGeo = new THREE.BufferGeometry(); const bgPos = []; const bgCols = [];
    for(let i=0;i<CONFIG.bgParticleCount;i++){
        bgPos.push((Math.random()-0.5)*2500, (Math.random()-0.5)*1800, (Math.random()-0.5)*2500);
        if(Math.random()>0.6) colHelper.setHex(CONFIG.colors.gold); else colHelper.setHex(0xFFFFFF);
        bgCols.push(colHelper.r, colHelper.g, colHelper.b);
    }
    bgGeo.setAttribute('position', new THREE.Float32BufferAttribute(bgPos,3));
    bgGeo.setAttribute('color', new THREE.Float32BufferAttribute(bgCols,3));
    const bgMat = new THREE.PointsMaterial({ size:3.5, vertexColors:true, blending:THREE.AdditiveBlending, transparent:true, opacity:0.6, map:createGlowTexture() });
    bgPoints = new THREE.Points(bgGeo, bgMat); scene.add(bgPoints);

    // C. Snow
    const snowGeo = new THREE.BufferGeometry(); const snowPos = [];
    for(let i=0;i<CONFIG.snowCount;i++) snowPos.push((Math.random()-0.5)*2000, (Math.random()-0.5)*2000+500, (Math.random()-0.5)*2000);
    snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(snowPos,3));
    const snowMat = new THREE.PointsMaterial({ size:4.0, color:CONFIG.colors.snow, transparent:true, opacity:0.8, map:createSnowTexture(), blending:THREE.AdditiveBlending, depthWrite:false });
    snowPoints = new THREE.Points(snowGeo, snowMat); scene.add(snowPoints);

    // D. Ribbon instanced
    const sphereGeo = new THREE.SphereGeometry(5,16,16);
    const sphereMat = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.2, metalness:0.1, emissive:0x000000 });
    ribbonMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, CONFIG.ribbonCount);
    const ribbonColors = [CONFIG.colors.ribbonRed, CONFIG.colors.ribbonGold, CONFIG.colors.ribbonBlue, CONFIG.colors.ribbonPurple, CONFIG.colors.ribbonCyan];
    for(let i=0;i<CONFIG.ribbonCount;i++){ const colorHex = ribbonColors[i % ribbonColors.length]; colHelper.setHex(colorHex); ribbonMesh.setColorAt(i, colHelper); }
    scene.add(ribbonMesh);

    // E. Star
    const starGeo = new THREE.OctahedronGeometry(20,0);
    const starMat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.starYellow });
    starMesh = new THREE.Mesh(starGeo, starMat); scene.add(starMesh);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:createGlowTexture(), color:CONFIG.colors.starYellow, blending:THREE.AdditiveBlending, opacity:0.4 }));
    halo.scale.set(120,120,1); starMesh.add(halo);

    // F. Photos
    scene.add(photosGroup);
    const photoGeo = new THREE.PlaneGeometry(1,1);
    for(let i=0;i<CONFIG.photoCount;i++){
        const tex = createPlaceholderTexture(`Memories ${i+1}`);
        const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, color: 0xe0e0e0 });
        const mesh = new THREE.Mesh(photoGeo, mat);
        mesh.userData = { id:i, baseWidth:40, baseHeight:52 };
        mesh.scale.set(40,52,1);
        photosGroup.add(mesh); photos.push(mesh);
    }
}

export function calculateLayouts(){
    // TREE PARTICLES
    const treePts = [];
    for(let i=0;i<CONFIG.treeParticleCount;i++){
        const h = Math.random() * 600 - 300; const normH = (h+300)/600; const maxR = (1 - normH) * 240; const r = Math.sqrt(Math.random()) * maxR; const theta = Math.random() * Math.PI * 2;
        treePts.push(r * Math.cos(theta), h, r * Math.sin(theta));
    }
    targets.tree.points = treePts;

    // Tree ribbons
    const ribbonMatsTree = [];
    for(let i=0;i<CONFIG.ribbonCount;i++){
        const t = i/CONFIG.ribbonCount; const angle = t * Math.PI * 18; const h = t*560 - 280; const r = (1 - t) * 250 + 10;
        dummy.position.set(Math.cos(angle)*r, h, Math.sin(angle)*r); dummy.rotation.set(0,0,0); dummy.scale.set(1,1,1); dummy.updateMatrix();
        ribbonMatsTree.push(dummy.matrix.clone());
    }
    targets.tree.ribbon = ribbonMatsTree;

    targets.tree.photos = photos.map((p,i)=>{
        const t = i / photos.length; const angle = t * Math.PI * 5; const h = t * 450 - 225; const r = (1 - ((h+300)/600)) * 260 + 30;
        const euler = new THREE.Euler(0, -angle, 0.2); const quat = new THREE.Quaternion().setFromEuler(euler);
        return { pos: new THREE.Vector3(Math.cos(angle)*r, h, Math.sin(angle)*r), quat: quat, scaleMult: 0.5 };
    });
    targets.tree.star = { pos: new THREE.Vector3(0,320,0), scale:1 };

    // CAROUSEL
    const scatterPoints = [];
    for(let i=0;i<CONFIG.treeParticleCount;i++) scatterPoints.push((Math.random()-0.5)*1500, (Math.random()-0.5)*1200, (Math.random()-0.5)*1500);
    targets.carousel.points = scatterPoints;
    const scatterRibbon = [];
    for(let i=0;i<CONFIG.ribbonCount;i++){ dummy.position.set((Math.random()-0.5)*1200, (Math.random()-0.5)*1200, (Math.random()-0.5)*1200); dummy.updateMatrix(); scatterRibbon.push(dummy.matrix.clone()); }
    targets.carousel.ribbon = scatterRibbon;
    targets.carousel.photos = photos.map((p,i)=>{ const angle = (i/photos.length)*Math.PI*2; const r = 320; const euler = new THREE.Euler(0, -angle - Math.PI/2, 0); const quat = new THREE.Quaternion().setFromEuler(euler); return { pos: new THREE.Vector3(Math.cos(angle)*r,0,Math.sin(angle)*r), quat: quat, scaleMult:1.0 }; });
    targets.carousel.star = { pos: new THREE.Vector3(0,800,0), scale:0.1 };

    // CHAOS
    const compactPoints = [];
    for(let i=0;i<CONFIG.treeParticleCount;i++) compactPoints.push((Math.random()-0.5)*600, (Math.random()-0.5)*500, (Math.random()-0.5)*600);
    targets.chaos.points = compactPoints;
    const compactRibbon = [];
    for(let i=0;i<CONFIG.ribbonCount;i++){ dummy.position.set((Math.random()-0.5)*500, (Math.random()-0.5)*500, (Math.random()-0.5)*500); dummy.updateMatrix(); compactRibbon.push(dummy.matrix.clone()); }
    targets.chaos.ribbon = compactRibbon;
    targets.chaos.photos = photos.map((p,i)=>{ const euler = new THREE.Euler(Math.random()*Math.PI*2, Math.random()*Math.PI*2, Math.random()*Math.PI*2); return { pos: new THREE.Vector3((Math.random()-0.5)*800,(Math.random()-0.5)*600,(Math.random()-0.5)*800), quat: new THREE.Quaternion().setFromEuler(euler), scaleMult: 0.5 + Math.random()*1.0 }; });
    targets.chaos.star = { pos: new THREE.Vector3(0,600,0), scale:0.1 };
}

export function getNearestPhotoIndex(){
    let minDst = Infinity; let idx = -1; const tmp = new THREE.Vector3();
    photos.forEach((p,i)=>{ p.getWorldPosition(tmp); const d = tmp.distanceTo(camera.position); if(d < minDst){ minDst = d; idx = i; } });
    return idx;
}

export function transitionTo(state, focusIdx = -1, fast = false){
    currentState = state; currentFocusIndex = focusIdx;
    const modeMap = { 'tree':'TREE FORM', 'carousel':'CAROUSEL GALLERY', 'chaos':'CHAOS MOTION', 'focus':'FOCUS MEMORY' };
    const statusEl = document.getElementById('status'); if(statusEl) statusEl.innerText = `Mode: ${modeMap[state]}`;

    const sceneRotDur = fast ? 200 : 1000;
    const photosGroupDur = fast ? 200 : 800;
    const posDur = fast ? 250 : 1500;
    const rotDur = fast ? 200 : 1500;
    const scaleDur = fast ? 200 : 1500;
    const starDur = fast ? 200 : 1500;

    if(state === 'tree'){ 
        controls.autoRotate = true; 
        try { new TWEEN.Tween(scene.rotation).to({ x:0, y:0, z:0 }, sceneRotDur).easing(TWEEN.Easing.Cubic.Out).start(); } catch(e){}
        // Reset photosGroup rotation and focus index so visuals return to tree layout
        currentFocusIndex = -1;
        try { new TWEEN.Tween(photosGroup.rotation).to({ x:0, y:0, z:0 }, photosGroupDur).easing(TWEEN.Easing.Cubic.Out).start(); } catch(e){}
    } else { controls.autoRotate = false; }

    let targetData = targets[state].photos;
    if(state === 'focus' && focusIdx !== -1){
        targetData = photos.map((p,i)=>{
            if(i === focusIdx){
                const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.normalize();
                const targetWorldPos = camera.position.clone().add(dir.multiplyScalar(200));
                const targetLocalPos = photosGroup.worldToLocal(targetWorldPos.clone());
                const dummyMatrix = new THREE.Matrix4(); dummyMatrix.lookAt(targetWorldPos, camera.position, camera.up);
                const worldQuat = new THREE.Quaternion().setFromRotationMatrix(dummyMatrix);
                const parentInverse = photosGroup.quaternion.clone().invert();
                const localQuat = parentInverse.multiply(worldQuat);
                return { pos: targetLocalPos, quat: localQuat, scaleMult: 4.0 };
            } else {
                const euler = new THREE.Euler(0,0,0);
                return { pos: new THREE.Vector3((Math.random()-0.5)*1500, (Math.random()-0.5)*1500, -1000), quat: new THREE.Quaternion().setFromEuler(euler), scaleMult: 0.1 };
            }
        });
    } else if(state === 'focus'){
        transitionTo('carousel', -1, fast); return;
    }

    photos.forEach((p,i)=>{
        if(!targetData[i]) return;
        new TWEEN.Tween(p.position).to(targetData[i].pos, posDur).easing(TWEEN.Easing.Cubic.Out).start();
        const startQ = p.quaternion.clone(); const endQ = targetData[i].quat; const rotObj = { t:0 };
        new TWEEN.Tween(rotObj).to({ t:1 }, rotDur).easing(TWEEN.Easing.Cubic.Out).onUpdate(()=>{ p.quaternion.slerpQuaternions(startQ, endQ, rotObj.t); }).start();
        const s = targetData[i].scaleMult; const targetScaleX = s * p.userData.baseWidth; const targetScaleY = s * p.userData.baseHeight;
        new TWEEN.Tween(p.scale).to({ x: targetScaleX, y: targetScaleY, z: s }, scaleDur).easing(TWEEN.Easing.Elastic.Out).start();
    });

    const starTgt = (state === 'tree') ? targets.tree.star : (state === 'chaos' ? targets.chaos.star : targets.carousel.star);
    if(starTgt){ new TWEEN.Tween(starMesh.position).to(starTgt.pos, starDur).easing(TWEEN.Easing.Cubic.Out).start(); new TWEEN.Tween(starMesh.scale).to({ x: starTgt.scale, y: starTgt.scale, z: starTgt.scale }, starDur).start(); }
}

export function getCurrentState(){ return currentState; }

export function setHandActive(val){ isHandActive = !!val; }

// 快速调整粒子/照片收敛速度（供手势无手时临时加速）
export function setMorphSpeed(val){ morphSpeed = Number(val) || morphSpeed; }
export function resetMorphSpeed(){ morphSpeed = 0.03; }

// 立即并快速回到收缩的树形状态（更短的 tween，用于无手快速恢复）
export function quickResetToTree(){
    currentState = 'tree';
    currentFocusIndex = -1;
    if(controls) controls.autoRotate = true;
    try{
        if(window.TWEEN && scene){
            new TWEEN.Tween(scene.rotation).to({ x:0, y:0, z:0 }, 200).easing(TWEEN.Easing.Cubic.Out).start();
        }
    } catch(e){}
    try{
        if(window.TWEEN && photosGroup){
            new TWEEN.Tween(photosGroup.rotation).to({ x:0, y:0, z:0 }, 200).easing(TWEEN.Easing.Cubic.Out).start();
        }
    } catch(e){}
}

export function startAnimation(app){
    function animate(){
        requestAnimationFrame(animate);
        const time = Date.now() * 0.001;
        TWEEN.update();
        controls.update();

        // Scene/PhotosGroup rotation
        if(!isHandActive){
            if(currentState === 'carousel') photosGroup.rotation.y += 0.006;
            else if(currentState === 'chaos') photosGroup.rotation.y += 0.002;
        } else {
            photosGroup.rotation.y = scene.rotation.y;
            if(currentState !== 'carousel') photosGroup.rotation.x = scene.rotation.x; else photosGroup.rotation.x = 0;
        }

        // Focus billboard
        if(currentState === 'focus' && currentFocusIndex !== -1){ const focusedPhoto = photos[currentFocusIndex]; if(focusedPhoto) focusedPhoto.lookAt(camera.position); }

        // Morph tree particles
        if(treePoints){ const cur = treePoints.geometry.attributes.position.array; let tgt;
            if(currentState === 'tree' || currentState === 'focus') tgt = targets.tree.points; else if(currentState === 'chaos') tgt = targets.chaos.points; else tgt = targets.carousel.points;
            for(let i=0;i<CONFIG.treeParticleCount*3;i++){ cur[i] += (tgt[i] - cur[i]) * morphSpeed; }
            treePoints.geometry.attributes.position.needsUpdate = true;
        }

        // Morph ribbon
        if(ribbonMesh){ let tgt; if(currentState === 'tree' || currentState === 'focus') tgt = targets.tree.ribbon; else if(currentState === 'chaos') tgt = targets.chaos.ribbon; else tgt = targets.carousel.ribbon;
            const m1 = new THREE.Matrix4(); const m2 = new THREE.Matrix4();
            for(let i=0;i<CONFIG.ribbonCount;i++){ ribbonMesh.getMatrixAt(i, m1); m2.copy(tgt[i]); for(let k=0;k<16;k++) m1.elements[k] += (m2.elements[k] - m1.elements[k]) * morphSpeed; ribbonMesh.setMatrixAt(i, m1); }
            ribbonMesh.instanceMatrix.needsUpdate = true;
        }

        // Background animation
        if(bgPoints){ const pos = bgPoints.geometry.attributes.position.array; for(let i=0;i<CONFIG.bgParticleCount;i++){ pos[i*3+1] += Math.sin(time*0.5 + pos[i*3]) * 0.2; } bgPoints.geometry.attributes.position.needsUpdate = true; }
        if(snowPoints){ const pos = snowPoints.geometry.attributes.position.array; for(let i=0;i<CONFIG.snowCount;i++){ pos[i*3+1] -= 0.5; if(pos[i*3+1] < -500) pos[i*3+1] = 500; pos[i*3] += Math.sin(time + i) * 0.1; } snowPoints.geometry.attributes.position.needsUpdate = true; }

        composer.render();
    }
    animate();
}

function onWindowResize(){ camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); }

function createGlowTexture(){ const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64; const ctx = canvas.getContext('2d'); const grad = ctx.createRadialGradient(32,32,0,32,32,32); grad.addColorStop(0,'rgba(255,255,255,1)'); grad.addColorStop(0.4,'rgba(255,255,255,0.3)'); grad.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle = grad; ctx.fillRect(0,0,64,64); return new THREE.CanvasTexture(canvas); }
function createSnowTexture(){ const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32; const ctx = canvas.getContext('2d'); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16,0); ctx.lineTo(16,32); ctx.moveTo(0,16); ctx.lineTo(32,16); ctx.moveTo(4,4); ctx.lineTo(28,28); ctx.moveTo(28,4); ctx.lineTo(4,28); ctx.stroke(); const grad = ctx.createRadialGradient(16,16,0,16,16,16); grad.addColorStop(0,'rgba(255,255,255,0.8)'); grad.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle = grad; ctx.fillRect(0,0,32,32); return new THREE.CanvasTexture(canvas); }
function createPlaceholderTexture(text){ const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 340; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0,0,256,340); ctx.fillStyle = '#222'; ctx.fillRect(10,10,236,250); ctx.fillStyle = '#666'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.fillText(text,128,140); ctx.font = 'italic 20px "Playfair Display"'; ctx.fillStyle = '#333'; ctx.fillText("Christmas 2024",128,300); return new THREE.CanvasTexture(canvas); }
