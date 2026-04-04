"use client";

import { FormEvent, useCallback, useRef, useState, DragEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import AppNavbar from "@/components/AppNavbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import Button from "@/components/ui/Button";
import {
  InputField,
  SelectField,
  TextAreaField,
} from "@/components/ui/FormFields";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Toast from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { createMissingReport } from "@/services/api";

const genderOptions = [
  { label: "Select gender", value: "" },
  { label: "Male", value: "Male" },
  { label: "Female", value: "Female" },
  { label: "Other", value: "Other" },
];

const DESC_MAX = 500;
const BIRTHMARKS_MAX = 200;

type FieldErrors = Record<string, string>;

export default function ReportMissingPage() {
  const { token } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [lastSeenLocation, setLastSeenLocation] = useState("");
  const [birthmarks, setBirthmarks] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, image: "Please select an image file." }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, image: "Image must be under 10 MB." }));
      return;
    }
    setImage(file);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
    const url = URL.createObjectURL(file);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
  }, []);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFile(file);
  };

  const removeImage = () => {
    setImage(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!name.trim()) errs.name = "Name is required.";
    if (!age.trim()) errs.age = "Age is required.";
    else if (Number(age) < 0 || Number(age) > 150)
      errs.age = "Enter a valid age.";
    if (!gender) errs.gender = "Please select a gender.";
    if (!description.trim()) errs.description = "Description is required.";
    if (description.length > DESC_MAX)
      errs.description = `Max ${DESC_MAX} characters.`;
    if (birthmarks.length > BIRTHMARKS_MAX)
      errs.birthmarks = `Max ${BIRTHMARKS_MAX} characters.`;
    if (!image) errs.image = "Please upload a photo.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const clearFieldError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setToast("");
    try {
      if (!token) {
        throw new Error("You are not authenticated. Please login again.");
      }

      const response = await createMissingReport(
        {
          name,
          age,
          gender,
          birthmarks,
          description,
          lastSeenLocation,
          image: image!,
        },
        token,
      );
      router.push(`/matches/${response.report_id}`);
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to submit report. Please try again.";
      setToast(message);
    } finally {
      setLoading(false);
    }
  };

  const fieldError = (field: string) =>
    errors[field] ? (
      <p className="mt-1 text-xs font-medium text-red-500">{errors[field]}</p>
    ) : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppNavbar />
      <ProtectedRoute>
        <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8">
          <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-red-600 dark:text-red-400"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  Report Missing Person
                </h1>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Submit details to begin AI-assisted matching.
                </p>
              </div>
            </div>

            {/* Progress indicator */}
            <div className="mt-6 flex gap-2">
              <div className="h-1 flex-1 rounded-full bg-cyan-500" />
              <div className="h-1 flex-1 rounded-full bg-cyan-500/30" />
              <div className="h-1 flex-1 rounded-full bg-cyan-500/30" />
            </div>

            <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
              {/* Section 1 — Photo Upload */}
              <fieldset>
                <legend className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                    1
                  </span>
                  Photo Upload
                </legend>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => !image && fileInputRef.current?.click()}
                  className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition ${
                    errors.image
                      ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-900/10"
                      : dragOver
                        ? "border-cyan-400 bg-cyan-50 dark:border-cyan-600 dark:bg-cyan-900/20"
                        : "border-slate-300 bg-slate-50 hover:border-cyan-400 hover:bg-cyan-50/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-cyan-600"
                  } ${image ? "p-3" : "px-6 py-10"}`}
                >
                  {preview && image ? (
                    <div className="relative w-full">
                      <div className="relative mx-auto h-56 w-full max-w-xs overflow-hidden rounded-xl">
                        <Image
                          src={preview}
                          alt="Preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 px-1">
                        <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                          {image.name}
                          <span className="ml-2 text-xs text-slate-400">
                            ({(image.size / 1024).toFixed(0)} KB)
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage();
                          }}
                          className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500"
                      >
                        <rect
                          width="18"
                          height="18"
                          x="3"
                          y="3"
                          rx="2"
                          ry="2"
                        />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Drag & drop a photo here
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        or{" "}
                        <span className="text-cyan-600 dark:text-cyan-400">
                          click to browse
                        </span>{" "}
                        — PNG, JPG up to 10 MB
                      </p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </div>
                {fieldError("image")}
              </fieldset>

              {/* Section 2 — Personal Information */}
              <fieldset>
                <legend className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                    2
                  </span>
                  Personal Information
                </legend>

                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <InputField
                        id="name"
                        label="Full Name"
                        placeholder="e.g. Ravi Kumar"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          clearFieldError("name");
                        }}
                        className={
                          errors.name
                            ? "!border-red-400 !ring-red-100 dark:!border-red-600"
                            : ""
                        }
                      />
                      {fieldError("name")}
                    </div>
                    <div>
                      <InputField
                        id="age"
                        label="Age"
                        type="number"
                        min={0}
                        max={150}
                        placeholder="e.g. 25"
                        value={age}
                        onChange={(e) => {
                          setAge(e.target.value);
                          clearFieldError("age");
                        }}
                        className={
                          errors.age
                            ? "!border-red-400 !ring-red-100 dark:!border-red-600"
                            : ""
                        }
                      />
                      {fieldError("age")}
                    </div>
                  </div>

                  <div>
                    <SelectField
                      id="gender"
                      label="Gender"
                      options={genderOptions}
                      value={gender}
                      onChange={(e) => {
                        setGender(e.target.value);
                        clearFieldError("gender");
                      }}
                      className={
                        errors.gender
                          ? "!border-red-400 !ring-red-100 dark:!border-red-600"
                          : ""
                      }
                    />
                    {fieldError("gender")}
                  </div>

                  <div>
                    <InputField
                      id="birthmarks"
                      label="Birthmarks / Identifiers"
                      placeholder="Forehead scar, mole on left cheek"
                      value={birthmarks}
                      onChange={(e) => {
                        if (e.target.value.length <= BIRTHMARKS_MAX) {
                          setBirthmarks(e.target.value);
                          clearFieldError("birthmarks");
                        }
                      }}
                      className={
                        errors.birthmarks
                          ? "!border-red-400 !ring-red-100 dark:!border-red-600"
                          : ""
                      }
                    />
                    <div className="mt-1 flex items-center justify-between">
                      {fieldError("birthmarks") ?? <span />}
                      <span
                        className={`text-xs ${birthmarks.length > BIRTHMARKS_MAX * 0.9 ? "text-amber-500" : "text-slate-400"}`}
                      >
                        {birthmarks.length}/{BIRTHMARKS_MAX}
                      </span>
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Section 3 — Last Seen Details */}
              <fieldset>
                <legend className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                    3
                  </span>
                  Last Seen Details
                </legend>

                <div className="space-y-4">
                  <InputField
                    id="last-seen-location"
                    label="Last Seen Location"
                    placeholder="Station, market, school area"
                    value={lastSeenLocation}
                    onChange={(e) => setLastSeenLocation(e.target.value)}
                  />

                  <div>
                    <TextAreaField
                      id="description"
                      label="Description"
                      placeholder="Clothing, last-seen details, physical identifiers, behaviour"
                      rows={4}
                      value={description}
                      onChange={(e) => {
                        if (e.target.value.length <= DESC_MAX) {
                          setDescription(e.target.value);
                          clearFieldError("description");
                        }
                      }}
                      className={
                        errors.description
                          ? "!border-red-400 !ring-red-100 dark:!border-red-600"
                          : ""
                      }
                    />
                    <div className="mt-1 flex items-center justify-between">
                      {fieldError("description") ?? <span />}
                      <span
                        className={`text-xs ${description.length > DESC_MAX * 0.9 ? "text-amber-500" : "text-slate-400"}`}
                      >
                        {description.length}/{DESC_MAX}
                      </span>
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Toast */}
              {toast ? (
                <Toast
                  message={toast}
                  tone={toast.includes("successfully") ? "success" : "error"}
                />
              ) : null}

              {/* Submit */}
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? (
                  <LoadingSpinner label="Submitting & searching..." />
                ) : (
                  "Submit & Search"
                )}
              </Button>
            </form>
          </section>
        </main>
      </ProtectedRoute>
    </div>
  );
}
