"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

/**
 * Drag-and-drop area with a "choose files" link. Owns only the drop target;
 * the file list and validation stay with the caller (`onFiles`). Replaces the
 * ten hand-rolled `<input type="file">` + dashed box combos.
 */
export default function FileDropzone({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  prompt = "Arraste os arquivos aqui ou",
  cta = "escolha os arquivos",
  hint,
  className = "",
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  prompt?: string;
  cta?: string;
  /** Secondary line, e.g. accepted formats and size limit. */
  hint?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function emit(list: FileList | null) {
    if (!list || list.length === 0) return;
    onFiles(multiple ? Array.from(list) : [list[0]]);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) emit(e.dataTransfer.files);
      }}
      className={`rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-quick ${
        dragging ? "border-primary bg-selected" : "border-line bg-sub-bg"
      } ${disabled ? "pointer-events-none opacity-60" : ""} ${className}`}
    >
      <UploadCloud size={20} className="mx-auto mb-2 text-muted" aria-hidden />
      <p className="text-xs text-muted">
        {prompt}{" "}
        <button
          type="button"
          className="font-semibold text-primary underline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          {cta}
        </button>
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
