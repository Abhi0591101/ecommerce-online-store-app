// Interactive Multi-File Drag & Drop Batch Uploader + Gallery Manager + Canvas Cropper
// For Products, Stores, Categories & Services in Admin Studio

class ImageUploaderStudio {
  constructor() {
    this.activeInputTargetId = null;
    this.activeFolder = 'products';
    this.activePreviewTargetId = null;
    this.currentImage = null;
    this.currentRawFile = null;
    this.currentEditingIndex = null;
    
    // Multi-Image Gallery Store per Target Input
    this.galleries = {}; // { 'newProdPhoto': ['url1', 'url2', 'url3'] }

    this.aspectRatio = 1; // Default 1:1 Square
    this.zoom = 1;
    this.cropX = 0;
    this.cropY = 0;
    this.cropWidth = 220;
    this.cropHeight = 220;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    this.initModal();
  }

  initModal() {
    if (document.getElementById('cropperModal')) return;

    const modalHtml = `
      <div id="cropperModal" class="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[99999] hidden items-center justify-center p-4">
        <div class="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          
          <!-- Header -->
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div class="flex items-center gap-2">
              <span class="text-lg">✂️</span>
              <div>
                <h3 class="font-black text-slate-900 text-sm">Image Cropper & Frame Adjuster</h3>
                <p class="text-[11px] text-slate-500">Fine-tune image framing, aspect ratio, or save</p>
              </div>
            </div>
            <button type="button" onclick="window.imageStudio.closeModal()" class="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs">
              ✕
            </button>
          </div>

          <!-- Cropper Canvas Area -->
          <div class="p-5 flex flex-col items-center bg-slate-900/5">
            <div class="relative w-full max-w-[340px] h-[300px] bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center cursor-move select-none" id="cropCanvasContainer">
              <canvas id="cropCanvas" class="max-w-full max-h-full"></canvas>
              
              <!-- Visual Crop Grid Overlay -->
              <div id="cropOverlayBox" class="absolute pointer-events-none border-2 border-indigo-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] rounded-lg flex items-center justify-center">
                <div class="w-full h-full border border-dashed border-white/60"></div>
              </div>
            </div>

            <!-- Aspect Ratio & Controls -->
            <div class="w-full mt-4 space-y-3">
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="font-bold text-slate-700">Aspect Ratio:</span>
                <div class="flex gap-1">
                  <button type="button" onclick="window.imageStudio.setAspectRatio(1)" id="btnRatio1_1" class="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-indigo-600 text-white shadow-sm">1:1 Square</button>
                  <button type="button" onclick="window.imageStudio.setAspectRatio(16/9)" id="btnRatio16_9" class="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-slate-200 text-slate-700 hover:bg-slate-300">16:9 Banner</button>
                  <button type="button" onclick="window.imageStudio.setAspectRatio(4/3)" id="btnRatio4_3" class="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-slate-200 text-slate-700 hover:bg-slate-300">4:3 Card</button>
                </div>
              </div>

              <!-- Zoom Slider -->
              <div class="flex items-center gap-3 text-xs">
                <span class="font-bold text-slate-700">🔍 Zoom:</span>
                <input type="range" id="cropZoomRange" min="1" max="3" step="0.05" value="1" oninput="window.imageStudio.handleZoom(this.value)" class="w-full accent-indigo-600">
                <button type="button" onclick="window.imageStudio.resetCrop()" class="text-[10px] text-indigo-600 font-bold hover:underline whitespace-nowrap">Reset</button>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
            <button type="button" onclick="window.imageStudio.closeModal()" class="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-200 font-bold text-xs">
              Cancel
            </button>
            <button type="button" onclick="window.imageStudio.applyCropAndUpload()" id="btnApplyCrop" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition">
              <span>✂️ Apply Crop & Update</span>
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.bindCanvasEvents();
  }

  bindCanvasEvents() {
    const container = document.getElementById('cropCanvasContainer');
    if (!container) return;

    container.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.cropX;
      this.dragStartY = e.clientY - this.cropY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.cropX = e.clientX - this.dragStartX;
      this.cropY = e.clientY - this.dragStartY;
      this.drawCanvas();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch support
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragStartX = e.touches[0].clientX - this.cropX;
        this.dragStartY = e.touches[0].clientY - this.cropY;
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      this.cropX = e.touches[0].clientX - this.dragStartX;
      this.cropY = e.touches[0].clientY - this.dragStartY;
      this.drawCanvas();
    });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  // Multi-File Drag & Drop HTML Generator
  renderDropzone(targetInputId, folder = 'products', previewTargetId = null) {
    const dropId = `dropzone_${targetInputId}`;
    const fileInputId = `fileinput_${targetInputId}`;

    return `
      <div class="space-y-3">
        <!-- Interactive Multi-File Drag & Drop Zone -->
        <div id="${dropId}" 
             onclick="document.getElementById('${fileInputId}').click()" 
             ondragover="event.preventDefault(); this.classList.add('border-indigo-600', 'bg-indigo-50/50')" 
             ondragleave="this.classList.remove('border-indigo-600', 'bg-indigo-50/50')" 
             ondrop="event.preventDefault(); event.stopPropagation(); this.classList.remove('border-indigo-600', 'bg-indigo-50/50'); window.imageStudio.handleFiles(event.dataTransfer.files, '${targetInputId}', '${folder}', '${previewTargetId}')" 
             class="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/20 rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group">
          
          <input type="file" id="${fileInputId}" multiple accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" onchange="window.imageStudio.handleFiles(this.files, '${targetInputId}', '${folder}', '${previewTargetId}')">
          
          <div class="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl group-hover:scale-110 transition shadow-inner">
            📸
          </div>
          
          <div>
            <p class="font-black text-slate-800 text-xs">
              Drag & Drop Multiple Photos, or Click to Browse
            </p>
            <p class="text-[10px] text-slate-500 mt-0.5">Select 1 or multiple images (JPG, PNG, WebP) simultaneously</p>
          </div>

          <div class="mt-1">
            <span class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition pointer-events-none">
              📁 Choose Multiple Photos
            </span>
          </div>
        </div>

        <!-- Upload Status Banner -->
        <div id="uploadStatus_${targetInputId}" class="hidden p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-800 items-center justify-between">
          <span id="uploadStatusText_${targetInputId}">⏳ Uploading photos to server...</span>
        </div>

        <!-- Multi-Image Thumbnails Gallery Tray -->
        <div id="thumbTray_${targetInputId}" class="flex flex-wrap gap-2.5 empty:hidden"></div>
      </div>
    `;
  }

  // Handle Multi-File Selection & Batch Upload
  async handleFiles(fileList, targetInputId, folder = 'products', previewTargetId = null) {
    if (!fileList || fileList.length === 0) return;

    this.activeInputTargetId = targetInputId;
    this.activeFolder = folder;
    this.activePreviewTargetId = previewTargetId;

    if (!this.galleries[targetInputId]) {
      this.galleries[targetInputId] = [];
    }

    const statusBanner = document.getElementById(`uploadStatus_${targetInputId}`);
    const statusText = document.getElementById(`uploadStatusText_${targetInputId}`);

    if (statusBanner) {
      statusBanner.classList.remove('hidden');
      statusBanner.classList.add('flex');
    }

    const total = fileList.length;
    let uploadedCount = 0;
    const uploadUrl = (window.apiService && window.apiService.baseUrl) ? `${window.apiService.baseUrl}/upload` : 'api/upload';

    for (let i = 0; i < total; i++) {
      const file = fileList[i];
      if (statusText) statusText.innerText = `⏳ Uploading image ${i + 1} of ${total}...`;

      try {
        const base64 = await this.fileToBase64(file);
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folder: this.activeFolder,
            image_base64: base64
          })
        });

        const json = await res.json();
        if (json.success && json.data.primary_url) {
          this.galleries[targetInputId].push(json.data.primary_url);
          uploadedCount++;
        }
      } catch (err) {
        console.error('Failed to upload file:', file.name, err);
      }
    }

    if (statusBanner) {
      statusBanner.classList.add('hidden');
      statusBanner.classList.remove('flex');
    }

    const fileInput = document.getElementById(`fileinput_${targetInputId}`);
    if (fileInput) fileInput.value = '';

    this.renderGalleryTray(targetInputId);

    if (uploadedCount > 0 && window.notify) {
      window.notify.success(`Added ${uploadedCount} photo(s) to gallery!`, 'Images Uploaded');
    }
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  setInitialImage(targetInputId, url) {
    if (!url) return;
    this.galleries[targetInputId] = [url];
    const targetInput = document.getElementById(targetInputId);
    if (targetInput) targetInput.value = url;
    this.renderGalleryTray(targetInputId);
  }

  setInitialGallery(targetInputId, urls) {
    if (!urls || !Array.isArray(urls)) return;
    this.galleries[targetInputId] = [...new Set(urls.filter(Boolean))];
    const targetInput = document.getElementById(targetInputId);
    if (targetInput) targetInput.value = this.galleries[targetInputId][0] || '';
    this.renderGalleryTray(targetInputId);
  }

  // Render Multi-Image Gallery Thumbnails Tray
  renderGalleryTray(targetInputId) {
    const list = this.galleries[targetInputId] || [];
    const tray = document.getElementById(`thumbTray_${targetInputId}`);
    const targetInput = document.getElementById(targetInputId);

    // Update primary cover URL in target input
    if (targetInput) {
      targetInput.value = list.length > 0 ? list[0] : '';
    }

    if (!tray) return;

    if (list.length === 0) {
      tray.innerHTML = '';
      return;
    }

    tray.innerHTML = list.map((url, idx) => `
      <div class="relative group border-2 ${idx === 0 ? 'border-indigo-600 ring-2 ring-indigo-300' : 'border-slate-200'} rounded-2xl overflow-hidden w-24 h-24 shadow-md bg-white flex items-center justify-center">
        <img src="${url}" class="w-full h-full object-cover" alt="Photo ${idx + 1}">
        
        <!-- Primary Cover Badge -->
        ${idx === 0 ? `
          <div class="absolute top-1 left-1 bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
            ⭐ Cover
          </div>
        ` : `
          <button type="button" onclick="event.stopPropagation(); window.imageStudio.setAsCover('${targetInputId}', ${idx})" title="Set as Main Cover Photo" class="absolute top-1 left-1 bg-slate-900/80 hover:bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition shadow-xs">
            Set Cover
          </button>
        `}

        <!-- Hover Action Toolbar -->
        <div class="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 p-1">
          <button type="button" onclick="event.stopPropagation(); window.imageStudio.openCropperForUrl('${url}', '${targetInputId}', ${idx})" title="Crop / Resize" class="w-7 h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center text-xs shadow-sm">
            ✂️
          </button>
          <button type="button" onclick="event.stopPropagation(); window.imageStudio.deleteFromGallery('${targetInputId}', ${idx})" title="Delete from Server" class="w-7 h-7 bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center justify-center text-xs shadow-sm">
            🗑️
          </button>
        </div>
      </div>
    `).join('');
  }

  // Set any photo as the main Cover Photo
  setAsCover(targetInputId, index) {
    if (!this.galleries[targetInputId] || !this.galleries[targetInputId][index]) return;
    const item = this.galleries[targetInputId].splice(index, 1)[0];
    this.galleries[targetInputId].unshift(item);
    this.renderGalleryTray(targetInputId);
  }

  // Delete specific photo from server and gallery
  deleteFromGallery(targetInputId, index) {
    if (!this.galleries[targetInputId] || !this.galleries[targetInputId][index]) return;
    const url = this.galleries[targetInputId][index];

    const doDelete = async () => {
      try {
        const uploadUrl = (window.apiService && window.apiService.baseUrl) ? `${window.apiService.baseUrl}/upload` : 'api/upload';
        await fetch(uploadUrl, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: url })
        });
      } catch (e) {
        console.warn('Server delete note:', e.message);
      }

      this.galleries[targetInputId].splice(index, 1);
      this.renderGalleryTray(targetInputId);
      if (window.notify) window.notify.success('Image removed from gallery');
    };

    if (window.notify) {
      window.notify.confirm({
        title: 'Delete Photo?',
        message: 'Are you sure you want to remove this photo from the gallery and server?',
        confirmText: 'Delete',
        isDanger: true,
        onConfirm: doDelete
      });
    } else {
      if (confirm('Delete this photo?')) doDelete();
    }
  }

  // Open Canvas Cropper for existing uploaded photo
  openCropperForUrl(url, targetInputId, index) {
    this.activeInputTargetId = targetInputId;
    this.currentEditingIndex = index;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.currentImage = img;
      this.resetCrop();
      this.openModal();
    };
    img.src = url;
  }

  openModal() {
    const modal = document.getElementById('cropperModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      this.updateOverlaySize();
      this.drawCanvas();
    }
  }

  closeModal() {
    const modal = document.getElementById('cropperModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  setAspectRatio(ratio) {
    this.aspectRatio = ratio;
    ['btnRatio1_1', 'btnRatio16_9', 'btnRatio4_3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.className = 'px-2.5 py-1 rounded-lg font-bold text-[11px] bg-slate-200 text-slate-700 hover:bg-slate-300';
    });

    if (ratio === 1) document.getElementById('btnRatio1_1')?.classList.replace('bg-slate-200', 'bg-indigo-600');
    if (ratio === 16/9) document.getElementById('btnRatio16_9')?.classList.replace('bg-slate-200', 'bg-indigo-600');
    if (ratio === 4/3) document.getElementById('btnRatio4_3')?.classList.replace('bg-slate-200', 'bg-indigo-600');

    this.updateOverlaySize();
    this.drawCanvas();
  }

  updateOverlaySize() {
    const overlay = document.getElementById('cropOverlayBox');
    if (!overlay) return;

    const baseSize = 220;
    if (this.aspectRatio >= 1) {
      this.cropWidth = baseSize;
      this.cropHeight = baseSize / this.aspectRatio;
    } else {
      this.cropHeight = baseSize;
      this.cropWidth = baseSize * this.aspectRatio;
    }

    overlay.style.width = `${this.cropWidth}px`;
    overlay.style.height = `${this.cropHeight}px`;
  }

  handleZoom(val) {
    this.zoom = parseFloat(val);
    this.drawCanvas();
  }

  resetCrop() {
    this.zoom = 1;
    this.cropX = 0;
    this.cropY = 0;
    const zoomRange = document.getElementById('cropZoomRange');
    if (zoomRange) zoomRange.value = 1;
    this.updateOverlaySize();
    this.drawCanvas();
  }

  drawCanvas() {
    const canvas = document.getElementById('cropCanvas');
    if (!canvas || !this.currentImage) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 340;
    canvas.height = 300;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const imgW = this.currentImage.width;
    const imgH = this.currentImage.height;

    const scale = Math.min(canvas.width / imgW, canvas.height / imgH) * this.zoom;
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    const centerX = (canvas.width - drawW) / 2 + this.cropX;
    const centerY = (canvas.height - drawH) / 2 + this.cropY;

    ctx.drawImage(this.currentImage, centerX, centerY, drawW, drawH);
  }

  // Apply Cropped version to specific image in Gallery
  async applyCropAndUpload() {
    if (!this.currentImage) return;

    const btn = document.getElementById('btnApplyCrop');
    if (btn) btn.innerHTML = '⏳ Processing Crop...';

    try {
      const outCanvas = document.createElement('canvas');
      const targetW = 600;
      const targetH = 600 / this.aspectRatio;
      outCanvas.width = targetW;
      outCanvas.height = targetH;
      const outCtx = outCanvas.getContext('2d');

      const canvas = document.getElementById('cropCanvas');
      const imgW = this.currentImage.width;
      const imgH = this.currentImage.height;
      const scale = Math.min(canvas.width / imgW, canvas.height / imgH) * this.zoom;

      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const imageCanvasX = (canvas.width - drawW) / 2 + this.cropX;
      const imageCanvasY = (canvas.height - drawH) / 2 + this.cropY;

      const cropBoxX = (canvas.width - this.cropWidth) / 2;
      const cropBoxY = (canvas.height - this.cropHeight) / 2;

      const srcX = (cropBoxX - imageCanvasX) / scale;
      const srcY = (cropBoxY - imageCanvasY) / scale;
      const srcW = this.cropWidth / scale;
      const srcH = this.cropHeight / scale;

      outCtx.drawImage(this.currentImage, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);

      const croppedBase64 = outCanvas.toDataURL('image/png', 0.92);
      const uploadUrl = (window.apiService && window.apiService.baseUrl) ? `${window.apiService.baseUrl}/upload` : 'api/upload';

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder: this.activeFolder || 'products',
          image_base64: croppedBase64
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Upload failed');

      const newUrl = json.data.primary_url;

      if (this.currentEditingIndex !== null && this.galleries[this.activeInputTargetId] && this.galleries[this.activeInputTargetId][this.currentEditingIndex] !== undefined) {
        this.galleries[this.activeInputTargetId][this.currentEditingIndex] = newUrl;
      } else if (this.activeInputTargetId) {
        if (!this.galleries[this.activeInputTargetId]) this.galleries[this.activeInputTargetId] = [];
        this.galleries[this.activeInputTargetId].push(newUrl);
      }

      this.currentEditingIndex = null;
      this.renderGalleryTray(this.activeInputTargetId);
      this.closeModal();
      if (btn) btn.innerHTML = '<span>✂️ Apply Crop & Update</span>';
      
      if (window.notify) {
        window.notify.success('Image cropped and updated in gallery!', 'Crop Saved');
      }
    } catch (err) {
      if (window.notify) window.notify.error('Crop failed: ' + err.message);
      if (btn) btn.innerHTML = '<span>✂️ Apply Crop & Update</span>';
    }
  }
}

window.imageStudio = new ImageUploaderStudio();
