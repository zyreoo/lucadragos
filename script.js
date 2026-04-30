const MEDIA_KEY = "birthdayGallery.mediaItems";
const CLOUDINARY_CLOUD_NAME = window.APP_CONFIG?.cloudinaryCloudName || "";
const CLOUDINARY_UPLOAD_PRESET = window.APP_CONFIG?.cloudinaryUploadPreset || "";

const openUploadBtn = document.getElementById("openUploadBtn");
const uploadDialog = document.getElementById("uploadDialog");
const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const captionInput = document.getElementById("captionInput");
const cancelUploadBtn = document.getElementById("cancelUploadBtn");
const galleryGrid = document.getElementById("galleryGrid");
const mediaCardTemplate = document.getElementById("mediaCardTemplate");
const statusText = document.getElementById("statusText");

function setStatus(message) {
  statusText.textContent = message;
}

function openDialog() {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    setStatus("Upload is not configured. Set Cloudinary values in app-config.js.");
    return;
  }
  uploadDialog.showModal();
}

function clearGallery() {
  galleryGrid.innerHTML = "";
}

function loadStoredMedia() {
  try {
    const raw = localStorage.getItem(MEDIA_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredMedia(items) {
  localStorage.setItem(MEDIA_KEY, JSON.stringify(items));
}

function showEmptyState() {
  const div = document.createElement("div");
  div.className = "empty-note";
  div.textContent = "No uploads yet. Use Add Photo or Video to begin.";
  galleryGrid.append(div);
}

function createMediaNode(item) {
  const fragment = mediaCardTemplate.content.cloneNode(true);
  const frame = fragment.querySelector(".media-frame");
  const caption = fragment.querySelector(".media-caption");
  const kind = fragment.querySelector(".media-kind");

  const isVideo = item.mediaType === "video";
  if (isVideo) {
    const video = document.createElement("video");
    video.controls = true;
    video.preload = "metadata";
    video.src = item.url;
    frame.append(video);
    kind.textContent = "VIDEO";
  } else {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = item.url;
    img.alt = item.caption || "Uploaded photo";
    frame.append(img);
    kind.textContent = "PHOTO";
  }

  caption.textContent = item.caption || (isVideo ? "Untitled video" : "Untitled photo");
  return fragment;
}

function renderMedia() {
  const items = loadStoredMedia().sort((a, b) => b.createdAt - a.createdAt);
  setStatus("Loading media...");
  clearGallery();
  if (items.length === 0) {
    setStatus("No uploads yet.");
    showEmptyState();
    return;
  }

  for (const item of items) {
    galleryGrid.append(createMediaNode(item));
  }
  setStatus(`${items.length} item${items.length === 1 ? "" : "s"} uploaded`);
}

async function uploadMedia(file, caption) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    setStatus("Upload is not configured. Set Cloudinary values in app-config.js.");
    return;
  }

  const mediaType = file.type.startsWith("video/") ? "video" : "photo";
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "birthday-ionut");

  setStatus("Uploading to Cloudinary...");
  openUploadBtn.disabled = true;

  let response;
  try {
    response = await fetch(endpoint, { method: "POST", body: formData });
  } catch {
    setStatus("Upload failed: network issue.");
    openUploadBtn.disabled = false;
    return;
  }

  if (!response.ok) {
    let errorMessage = "Cloudinary rejected the upload.";
    try {
      const errorPayload = await response.json();
      if (errorPayload?.error?.message) {
        errorMessage = errorPayload.error.message;
      }
    } catch {
      const errorText = await response.text();
      if (errorText) {
        errorMessage = errorText.slice(0, 120);
      }
    }
    setStatus(`Upload failed: ${errorMessage}`);
    openUploadBtn.disabled = false;
    return;
  }

  const payload = await response.json();
  const items = loadStoredMedia();
  items.push({
    id: payload.asset_id || crypto.randomUUID(),
    url: payload.secure_url,
    mediaType,
    caption: caption || "",
    createdAt: Date.now(),
  });
  saveStoredMedia(items);

  setStatus("Upload complete.");
  openUploadBtn.disabled = false;
  renderMedia();
}

openUploadBtn.addEventListener("click", openDialog);

cancelUploadBtn.addEventListener("click", () => {
  uploadDialog.close();
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = fileInput.files?.[0];
  const caption = captionInput.value.trim();
  if (!file) return;

  uploadDialog.close();
  await uploadMedia(file, caption);
  fileInput.value = "";
  captionInput.value = "";
});

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
  setStatus("Set Cloudinary values in app-config.js.");
} else {
  setStatus("Ready to upload.");
}
renderMedia();
