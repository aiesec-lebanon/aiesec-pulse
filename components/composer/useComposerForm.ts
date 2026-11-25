"use client";

import { useRef, useState } from "react";

import { EMPTY_DOCUMENT, plainTextFromDocument, type PulseDocument } from "@/lib/content/document";
import { uploadImage } from "@/lib/upload-client";

export type ComposerInitialValues = {
  title: string;
  /** The phrase the author had chosen to accent, when resuming a draft. */
  titleAccent: string;
  bodyJson: PulseDocument;
  summary: string;
  linkUrl: string;
  mediaUrl: string | null;
  mediaAlt: string;
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Owns the composer's field state and cover-image upload flow, shared by
 * both /posts/new and /posts/[slug]/edit so neither route duplicates it.
 */
export function useComposerForm(initialValues?: ComposerInitialValues) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [titleAccent, setTitleAccent] = useState(initialValues?.titleAccent ?? "");
  const [bodyJson, setBodyJson] = useState<PulseDocument>(
    initialValues?.bodyJson ?? EMPTY_DOCUMENT
  );
  const [summary, setSummary] = useState(initialValues?.summary ?? "");
  const [linkUrl, setLinkUrl] = useState(initialValues?.linkUrl ?? "");
  const [mediaAlt, setMediaAlt] = useState(initialValues?.mediaAlt ?? "");

  const [imagePreview, setImagePreview] = useState<string | null>(initialValues?.mediaUrl ?? null);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState<string | null>(
    initialValues?.mediaUrl ?? null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bodyText = plainTextFromDocument(bodyJson);
  const hasContent =
    title.trim().length > 0 ||
    bodyText.trim().length > 0 ||
    summary.trim().length > 0 ||
    linkUrl.trim().length > 0 ||
    imagePreview !== null;

  function clearImage() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setImagePreview(null);
    setUploadedMediaUrl(null);
    setMediaAlt("");
    setIsUploading(false);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileSelected(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Only JPEG, PNG, and WEBP images are allowed.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image must be 5 MB or smaller.");
      return;
    }

    setImageError(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setImagePreview(objectUrl);
    setUploadedMediaUrl(null);
    setIsUploading(true);

    try {
      setUploadedMediaUrl(await uploadImage(file));
    } catch (err) {
      clearImage();
      setImageError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  const linkDomain = extractDomain(linkUrl);
  const linkIsValid = linkUrl.length > 0 && linkDomain.length > 0;
  const linkIsInvalid = linkUrl.length > 0 && !linkIsValid;

  return {
    title,
    setTitle,
    titleAccent,
    setTitleAccent,
    bodyJson,
    setBodyJson,
    summary,
    setSummary,
    linkUrl,
    setLinkUrl,
    mediaAlt,
    setMediaAlt,

    imagePreview,
    uploadedMediaUrl,
    isUploading,
    imageError,
    fileInputRef,
    clearImage,
    handleFileSelected,

    bodyText,
    hasContent,
    linkDomain,
    linkIsValid,
    linkIsInvalid,
  };
}

export type ComposerForm = ReturnType<typeof useComposerForm>;
