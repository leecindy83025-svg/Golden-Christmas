export function handleImageUploadSetup(app, e){
    const files = e.target.files; if(!files || !files.length) return;
    let fileIndex = 0; const maxPhotos = (app && app.photos) ? app.photos.length : 0;
    Array.from(files).forEach((file)=>{
        if(!file.type.startsWith('image/')) return; if(fileIndex>=maxPhotos) return;
        const currentPhotoIndex = fileIndex; const reader = new FileReader();
        reader.onload = (evt)=>{
            const img = new Image(); img.onload = ()=>{
                const THREE = (app && app.THREE) ? app.THREE : window.THREE;
                const tex = new THREE.Texture(img);
                if (tex) {
                    if(THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
                    tex.needsUpdate = true;
                }
                const mesh = app.photos[currentPhotoIndex];
                mesh.material.map = tex; mesh.material.needsUpdate = true;
                const aspect = img.width / img.height;
                mesh.userData.baseHeight = 52; mesh.userData.baseWidth = 52 * aspect;
                let mult = 0.5;
                const state = (app && typeof app.getCurrentState === 'function') ? app.getCurrentState() : null;
                if(state === 'carousel') mult = 1.0;
                if(state === 'chaos') mult = (0.5 + Math.random());
                mesh.scale.set(mesh.userData.baseWidth * mult, mesh.userData.baseHeight * mult, mult);
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
        fileIndex++;
    });
}
