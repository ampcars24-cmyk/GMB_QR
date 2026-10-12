// Uses the existing tracking endpoint; the receiver must be deployed first.
(() => {
  const collectorInput = document.querySelector('#collector-id');
  const statusText = document.querySelector('#upload-status');
  const uploadButton = document.querySelector('#upload-screenshot');
  const picker = document.querySelector('#review-screenshot');
  const cameraButton = document.querySelector('#open-camera');
  const nativeCamera = document.querySelector('#camera-file');
  const cameraPanel = document.querySelector('#camera-panel');
  const video = document.querySelector('#camera-video');
  const captureButton = document.querySelector('#capture-photo');
  const preview = document.querySelector('#snapshot-preview');
  let chosenFile = null;
  let stream = null;
  let cameraPending = false;
  let cameraGeneration = 0;
  let previewUrl = null;
  function stopCamera() {
    cameraGeneration++;
    cameraPending = false;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    cameraPanel.classList.add('hidden');
    captureButton.disabled = true;
  }
  function chooseFile(file) {
    chosenFile = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = file ? URL.createObjectURL(file) : null;
    if (previewUrl) { preview.src = previewUrl; preview.classList.remove('hidden'); }
    else { preview.removeAttribute('src'); preview.classList.add('hidden'); }
  }
  function canvasFile(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (!blob || blob.size > 2 * 1024 * 1024) { reject(new Error('Photo is too large. Please retake it or upload a smaller image.')); return; }
      resolve(new File([blob], `review-photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.82));
  }
  function photoCanvas(image, width, height) {
    const scale = Math.min(1, 1600 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  picker.addEventListener('change', () => {
    if (uploading) return;
    const file = picker.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024 || !file.size) {
      picker.value = ''; statusText.textContent = 'Choose a JPG, PNG or WebP image up to 2 MB.'; return;
    }
    stopCamera(); chooseFile(file);
    statusText.textContent = 'Image selected. Tap Upload screenshot to submit.';
  });
  cameraButton.addEventListener('click', async () => {
    if (uploading || cameraPending || stream) return;
    if (!navigator.mediaDevices?.getUserMedia) { nativeCamera.click(); return; }
    cameraPending = true;
    const generation = ++cameraGeneration;
    statusText.textContent = 'Opening camera. Allow access if your browser asks.';
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } } });
      if (generation !== cameraGeneration) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired;
      video.srcObject = stream;
      cameraPanel.classList.remove('hidden');
      await video.play();
      statusText.textContent = 'Frame the review and tap Capture photo.';
    } catch (_) {
      stopCamera();
      statusText.textContent = 'Camera access was unavailable. You can upload an existing screenshot or try Take a photo again.';
    } finally { cameraPending = false; }
  });
  video.addEventListener('loadeddata', () => { captureButton.disabled = !video.videoWidth; });
  captureButton.addEventListener('click', async () => {
    if (!stream || !video.videoWidth || uploading) return;
    captureButton.disabled = true;
    try {
      const file = await canvasFile(photoCanvas(video, video.videoWidth, video.videoHeight));
      chooseFile(file); picker.value = ''; stopCamera();
      statusText.textContent = 'Photo captured. Tap Upload screenshot to submit, or Take a photo to retake.';
    } catch (error) { statusText.textContent = error.message; captureButton.disabled = false; }
  });
  document.querySelector('#close-camera').addEventListener('click', stopCamera);
  nativeCamera.addEventListener('change', async () => {
    const file = nativeCamera.files[0];
    if (!file || uploading) return;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      chooseFile(await canvasFile(photoCanvas(image, image.naturalWidth, image.naturalHeight)));
      picker.value = '';
      statusText.textContent = 'Photo captured. Tap Upload screenshot to submit.';
    } catch (_) { statusText.textContent = 'Could not read this photo. Please choose a JPG, PNG or WebP screenshot.'; }
    finally { URL.revokeObjectURL(url); nativeCamera.value = ''; }
  });
  window.addEventListener('pagehide', stopCamera);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
  collectorInput.value = collectorId;
  function readCollector() {
    collectorId = collectorInput.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    collectorInput.value = collectorId;
    return collectorId;
  }
  collectorInput.addEventListener('change', () => {
    readCollector();
    if (active) sendScanPostback('collector_assigned', active);
  });
  document.querySelector('#copy-collector-link').addEventListener('click', async () => {
    if (!readCollector()) { statusText.textContent = 'Enter a collector ID first.'; return; }
    const link = new URL(window.location.href);
    link.searchParams.set('collector_id', collectorId);
    link.hash = '';
    try {
      await navigator.clipboard.writeText(link.href);
      statusText.textContent = 'Collector review link copied. Share it with your customer.';
    } catch (_) {
      statusText.textContent = `Copy this link: ${link.href}`;
    }
  });
  let uploading = false;
  uploadButton.addEventListener('click', async () => {
    if (uploading) return;
    const branch = active;
    const file = chosenFile || picker.files[0];
    if (!branch) { statusText.textContent = 'Choose the branch you reviewed first.'; return; }
    if (!readCollector()) { statusText.textContent = 'Enter the collector ID provided by the Cars24 team.'; return; }
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      statusText.textContent = 'Choose a JPG, PNG or WebP screenshot.'; return;
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      statusText.textContent = 'Choose a screenshot smaller than 2 MB.'; return;
    }
    uploading = true;
    stopCamera();
    uploadButton.disabled = true;
    cameraButton.disabled = true;
    picker.disabled = true;
    statusText.textContent = 'Uploading your screenshot. Please keep this page open…';
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const uploadId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const payload = {
        eventId: scanEventId, eventType: 'screenshot_upload', uploadId,
        occurredAt: new Date().toISOString(), collectorId,
        intent: branch.intent, storeCode: branch.storeCode, code: branch.code,
        branchName: branch.name, city: branch.city, state: branch.state,
        reviewUrl: branch.reviewUrl, page: window.location.href,
        mimeType: file.type, imageBase64: dataUrl.split(',')[1]
      };
      // A form and response iframe allow an acknowledged Apps Script upload
      // without assuming an opaque no-cors response means the file was saved.
      await new Promise((resolve, reject) => {
        const frame = document.createElement('iframe');
        frame.name = `upload-${uploadId}`;
        frame.title = 'Screenshot upload response';
        frame.hidden = true;
        const form = document.createElement('form');
        form.method = 'POST'; form.action = TRACKING_ENDPOINT; form.target = frame.name;
        form.hidden = true;
        const field = document.createElement('input');
        field.type = 'hidden'; field.name = 'payload'; field.value = JSON.stringify(payload);
        form.append(field);
        const cleanup = () => {
          window.removeEventListener('message', onMessage);
          clearTimeout(timer); form.remove(); frame.remove();
        };
        const onMessage = (event) => {
          let origin;
          try { origin = new URL(event.origin).hostname; } catch (_) { return; }
          if (!(origin === 'script.google.com' || origin.endsWith('.googleusercontent.com'))) return;
          const reply = event.data;
          if (!reply || reply.service !== 'cars24-review-upload' || reply.uploadId !== uploadId) return;
          cleanup();
          if (reply.ok) resolve(); else reject(new Error(reply.message || 'Upload was not saved.'));
        };
        const timer = setTimeout(() => {
          cleanup(); reject(new Error('Upload confirmation did not arrive. Please ask the team to check Drive before retrying.'));
        }, 90000);
        window.addEventListener('message', onMessage);
        document.body.append(frame, form);
        form.submit();
      });
      statusText.textContent = `Screenshot saved for ${branch.storeCode}. Thank you!`;
      document.querySelector('#review-screenshot').value = '';
      chooseFile(null);
    } catch (error) {
      statusText.textContent = error.message || 'Upload could not be confirmed. Please try again.';
    } finally {
      uploading = false; uploadButton.disabled = false; cameraButton.disabled = false; picker.disabled = false;
    }
  });
})();
