import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiCamera,
  FiCheck,
  FiImage,
  FiInfo,
  FiUploadCloud,
  FiTrash2,
  FiLoader,
} from "react-icons/fi";
import imageCompression from "browser-image-compression";
import { supabase } from "../supabaseClient";
/* import NavBar from "../components/NavBar"; */
import { DEFAULT_AVATAR_URL } from "../components/Avatar";
import ImageCropModal from "../components/ImageCropModal";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = "profile_pictures";

// Validate Cloudinary configuration
const validateCloudinaryConfig = () => {
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary cloud name is not configured");
  }
  if (!CLOUDINARY_UPLOAD_PRESET) {
    throw new Error("Cloudinary upload preset is not configured");
  }
};

const UploadProfilePic = ({ userProfile, setUserProfile, deleteImage }) => {
  useDocumentTitle("Upload Profile Picture | QuizBolt");
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(userProfile?.avatar_url || null);
  const [rawImage, setRawImage] = useState(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    // Reset so picking the same file again re-triggers this handler
    // (common when the user cancels the crop step).
    event.target.value = "";
    if (!selectedFile) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(selectedFile.type)) {
      setStatus({
        type: "error",
        message: "Only JPEG, PNG or WEBP images are allowed.",
      });
      return;
    }

    setStatus({ type: "", message: "" });
    setRawImage({
      src: URL.createObjectURL(selectedFile),
      fileName: selectedFile.name,
      fileType: selectedFile.type,
    });
    setIsCropOpen(true);
  };

  const releaseRawImage = () => {
    if (rawImage?.src) URL.revokeObjectURL(rawImage.src);
    setRawImage(null);
  };

  const handleCropApply = (croppedFile) => {
    releaseRawImage();
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(croppedFile);
    setPreviewUrl(URL.createObjectURL(croppedFile));
    setIsCropOpen(false);
    setStatus({ type: "", message: "" });
  };

  const handleCropCancel = () => {
    releaseRawImage();
    setIsCropOpen(false);
    setStatus({ type: "", message: "" });
  };

  const triggerFileInput = () => fileInputRef.current.click();

  // Upload new profile picture
  const handleSave = async () => {
    if (!file) return;

    setUploading(true);
    setStatus({ type: "info", message: "Optimizing and uploading..." });

    try {
      // Validate Cloudinary configuration first
      validateCloudinaryConfig();

      // 1️⃣ Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Could not get user.");

      // 2️⃣ Compress image
      console.log("Compressing image...");
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 600,
        useWebWorker: true,
      });
      console.log("Image compressed successfully");

      // 3️⃣ Upload to Cloudinary as new image (no override)
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const uniquePublicId = `profile_pictures/${user.id}_${timestamp}_${randomId}`;

      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("public_id", uniquePublicId);

      // Only delete the old image if one actually exists
      const oldPublicId = userProfile?.avatar_public_id;
      if (
        oldPublicId &&
        typeof oldPublicId === "string" &&
        oldPublicId.trim() !== "NULL" &&
        oldPublicId.trim() !== ""
      ) {
        console.log("Deleting old Cloudinary image:", oldPublicId);
        await deleteImage(oldPublicId);
      }

      const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

      console.log("Uploading to Cloudinary...", {
        cloudName: CLOUDINARY_CLOUD_NAME,
        preset: CLOUDINARY_UPLOAD_PRESET,
        publicId: uniquePublicId,
      });

      const cloudRes = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      const cloudJson = await cloudRes.json();

      if (!cloudRes.ok) {
        console.error("Cloudinary error response:", cloudJson);
        throw new Error(
          cloudJson.error?.message ||
            `Cloudinary upload failed: ${cloudRes.status}`,
        );
      }

      console.log("Cloudinary upload successful:", cloudJson);

      // 4️⃣ Update Supabase
      console.log("Updating Supabase profile...");
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: cloudJson.secure_url,
          avatar_public_id: cloudJson.public_id,
        })
        .eq("id", user.id);
      if (updateError) {
        console.error("Supabase update error:", updateError);
        throw new Error("Failed to update profile in database");
      }
      console.log("Profile updated successfully");

      // 5️⃣ Update UI & status
      setStatus({ type: "success", message: "Profile updated!" });
      setPreviewUrl(cloudJson.secure_url);
      setFile(null);

      // Update local user profile state to reflect changes immediately
      if (setUserProfile && userProfile) {
        setUserProfile({
          ...userProfile,
          avatar_url: cloudJson.secure_url,
          avatar_public_id: cloudJson.public_id,
        });
      }

      setTimeout(() => navigate("/profile"), 900);
    } catch (error) {
      console.error("Upload error:", error);
      let errorMessage = "Upload failed.";

      if (error.message.includes("Cloudinary")) {
        errorMessage = "Image upload service error. Please try again.";
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorMessage = "Network error. Please check your connection.";
      } else if (error.message.includes("database")) {
        errorMessage = "Database error. Please try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setStatus({ type: "error", message: errorMessage });
    } finally {
      setUploading(false);
    }
  };

  // Remove current photo
  const handleRemovePhoto = async () => {
    setUploading(true);

    try {
      // 1️⃣ Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Could not get user.");

      console.log("Deleting Cloudinary image:", userProfile?.avatar_public_id);
      if (userProfile?.avatar_public_id) {
        await deleteImage(userProfile.avatar_public_id);
      }

      // 2️⃣ Update Supabase to clear avatar
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null, avatar_public_id: null })
        .eq("id", user.id);
      if (error) throw error;

      // 3️⃣ Update UI
      setFile(null);
      setPreviewUrl(null);
      setStatus({ type: "success", message: "Photo removed." });

      // Update local user profile state to reflect changes immediately
      if (setUserProfile && userProfile) {
        setUserProfile({
          ...userProfile,
          avatar_url: null,
          avatar_public_id: null,
        });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: "Failed to remove photo." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors duration-500">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 lg:px-8">
          {previewUrl ? (
            <button
              type="button"
              onClick={() =>
                window.history.length > 1 ? navigate(-1) : navigate("/")
              }
              className="size-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
              aria-label="Go back"
            >
              <FiArrowLeft size={20} />
            </button>
          ) : (
            <div className="size-11" />
          )}
          <div className="text-center">
            <h1 className="text-lg font-black tracking-tight">
              Profile Picture
            </h1>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Update your avatar
            </p>
          </div>
          <div className="size-11" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-32 pt-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-start">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            <div
              className="group relative aspect-square overflow-hidden rounded-3xl bg-slate-100 dark:bg-slate-800"
              role="button"
              tabIndex={0}
              onClick={triggerFileInput}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  triggerFileInput();
                }
              }}
            >
              <img
                src={
                  previewUrl &&
                  previewUrl.trim() !== "" &&
                  previewUrl !== "NULL"
                    ? previewUrl
                    : DEFAULT_AVATAR_URL
                }
                alt="Profile preview"
                className="size-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 transition-colors group-hover:bg-slate-950/30">
                <span className="scale-95 rounded-2xl bg-white/95 px-4 py-2 text-xs font-black text-slate-900 opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100">
                  Choose photo
                </span>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  triggerFileInput();
                }}
                className="absolute bottom-4 right-4 size-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200 transition-transform active:scale-95 dark:shadow-none"
                disabled={uploading}
                aria-label="Choose photo"
              >
                <FiCamera size={20} />
              </button>
            </div>

            {status.message && (
              <div
                className={`mt-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold ${
                  status.type === "error"
                    ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300"
                    : status.type === "success"
                      ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300"
                      : "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                }`}
              >
                {status.type === "success" ? <FiCheck /> : <FiInfo />}
                {status.message}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
              <h2 className="font-black">Photo controls</h2>
              <p className="text-xs font-semibold text-slate-400">
                Pick a photo, then adjust the crop before saving. JPEG, PNG,
                and WEBP are supported.
              </p>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <button
                type="button"
                onClick={triggerFileInput}
                disabled={uploading}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:opacity-60"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="size-10 shrink-0 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                    {previewUrl ? <FiUploadCloud /> : <FiImage />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-slate-900 dark:text-white">
                      {previewUrl ? "Change photo" : "Choose photo"}
                    </span>
                    <span className="block truncate text-xs font-medium text-slate-400">
                      Select an image from your device
                    </span>
                  </span>
                </span>
              </button>

              {previewUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={uploading}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="size-10 shrink-0 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 flex items-center justify-center">
                      <FiTrash2 />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-red-600 dark:text-red-300">
                        Remove current photo
                      </span>
                      <span className="block truncate text-xs font-medium text-slate-400">
                        Return to the default avatar
                      </span>
                    </span>
                  </span>
                </button>
              )}

              {!previewUrl && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("skipAvatar", "true");
                    navigate("/");
                  }}
                  disabled={uploading}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:opacity-60"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="size-10 shrink-0 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                      <FiArrowLeft />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-slate-900 dark:text-white">
                        Skip for now
                      </span>
                      <span className="block truncate text-xs font-medium text-slate-400">
                        Continue without a profile photo
                      </span>
                    </span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      {file && !isCropOpen && (
        <div className="fixed bottom-6 inset-x-5 z-50 mx-auto max-w-sm lg:left-[16rem]">
          <button
            type="button"
            onClick={handleSave}
            disabled={uploading}
            className="w-full rounded-2xl bg-blue-600 py-4 text-base font-black text-white shadow-2xl shadow-blue-200 dark:shadow-none flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70"
          >
            {uploading ? (
              <>
                <FiLoader className="animate-spin" /> Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      )}

      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={rawImage?.src}
        fileName={rawImage?.fileName}
        fileType={rawImage?.fileType}
        onCrop={handleCropApply}
        onCancel={handleCropCancel}
      />

      {/* {!file && <NavBar isPremium={isPremium} />} */}
    </div>
  );
};

export default UploadProfilePic;

import useDocumentTitle from "../hooks/useDocumentTitle";