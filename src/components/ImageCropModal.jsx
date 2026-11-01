import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { FiCrop, FiLoader, FiX, FiZoomIn, FiZoomOut } from "react-icons/fi";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

// Keep the exported avatar reasonably small — the upload pipeline
// compresses to 600px / 0.5MB anyway, and this keeps the canvas light on mobile.
const MAX_OUTPUT_SIZE = 1024;

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });

const canvasToBlob = (canvas, type) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, 0.92));

/**
 * Draws the user-selected region onto a square canvas and returns a File,
 * mirroring the output shape of the old fixed center-crop helper.
 */
const cropImageToFile = async ({ imageSrc, cropPixels, fileName, fileType }) => {
  const image = await loadImage(imageSrc);

  const scale = Math.min(
    1,
    MAX_OUTPUT_SIZE / Math.max(cropPixels.width, cropPixels.height),
  );
  const outputWidth = Math.max(1, Math.round(cropPixels.width * scale));
  const outputHeight = Math.max(1, Math.round(cropPixels.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  // Not every browser can encode every format (e.g. WEBP on Safari) —
  // fall back to JPEG so the crop never silently fails.
  let blob = await canvasToBlob(canvas, fileType);
  if (!blob) blob = await canvasToBlob(canvas, "image/jpeg");

  return new File([blob], fileName, { type: blob.type || fileType });
};

const ImageCropModal = ({
  isOpen,
  imageSrc,
  fileName = "avatar.jpg",
  fileType = "image/jpeg",
  onCrop,
  onCancel,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  // Held in a ref because it changes on every pan/zoom frame and
  // re-rendering on each update would be wasteful.
  const croppedAreaPixelsRef = useRef(null);

  // Reset the view whenever a fresh image is handed to the modal
  useEffect(() => {
    if (!isOpen) return;
    setCrop({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setIsProcessing(false);
    setError("");
    croppedAreaPixelsRef.current = null;
  }, [isOpen, imageSrc]);

  // Lock background scrolling while the crop step is active
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isProcessing) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isProcessing, onCancel]);

  const handleCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    if (!croppedAreaPixels) return;
    croppedAreaPixelsRef.current = croppedAreaPixels;
  }, []);

  const handleApply = async () => {
    const cropPixels = croppedAreaPixelsRef.current;
    if (!cropPixels || !imageSrc) return;

    setIsProcessing(true);
    setError("");

    try {
      const croppedFile = await cropImageToFile({
        imageSrc,
        cropPixels,
        fileName,
        fileType,
      });
      onCrop(croppedFile);
    } catch (err) {
      console.error("Crop failed:", err);
      setError("Could not crop this image. Please try another photo.");
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* No scale animation here — react-easy-crop needs stable dimensions
          while it measures the crop area. */}
      <div className="relative w-full max-w-[480px] max-h-[92vh] overflow-y-auto overflow-x-hidden no-scrollbar rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <span className="size-10 shrink-0 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 flex items-center justify-center">
            <FiCrop size={18} />
          </span>
          <div className="min-w-0">
            <h2
              id="crop-modal-title"
              className="text-base font-black text-slate-900 dark:text-white"
            >
              Adjust your photo
            </h2>
            <p className="truncate text-xs font-semibold text-slate-400">
              Drag to reposition · pinch or slide to zoom
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            aria-label="Cancel crop"
            className="ml-auto size-9 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Crop area — fixed 1:1 so the output is always a square avatar */}
        <div className="px-5 pt-5">
          <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-slate-950">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              restrictPosition
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              style={{
                cropAreaStyle: {
                  border: "2px solid rgba(255, 255, 255, 0.9)",
                  // Drives the color of the library's own dimming overlay
                  color: "rgba(2, 6, 23, 0.65)",
                },
              }}
            />
          </div>
        </div>

        {/* Zoom control */}
        <div className="flex items-center gap-3 px-5 pt-4">
          <FiZoomOut size={18} className="shrink-0 text-slate-400" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            disabled={isProcessing}
            aria-label="Zoom"
            className="w-full cursor-pointer accent-blue-600 disabled:opacity-50"
          />
          <FiZoomIn size={18} className="shrink-0 text-slate-400" />
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-2xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="h-12 flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isProcessing}
            className="h-12 flex-1 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <FiLoader className="animate-spin" /> Applying...
              </>
            ) : (
              "Apply"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ImageCropModal;
