"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Category } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { write } from "@/lib/db";
import { GROUPS, PILLARS, BRAND, FRAMEWORK_FIELDS } from "@/lib/config";

interface AddIdeaModalProps {
  teamId: string;
  teamSlug?: string;
  category: Category;
  onClose: () => void;
  onSuccess?: () => void;
  onAddLocal?: (name: string, description: string | null) => void;
}

interface ModalTheme {
  bg: string;
  text: string;
  labelColor: string;
  inputBg: string;
  inputBorder: string;
  inputFocusBorder: string;
  inputText: string;
  inputPlaceholder: string;
  overlayBg: string;
  cancelBg: string;
  cancelBorder: string;
  cancelText: string;
  submitBg: string;
  submitText: string;
}

function makeModalTheme(color: string): ModalTheme {
  return {
    bg: "#FFFFFF",
    text: BRAND.colors.ink,
    labelColor: BRAND.colors.ink,
    inputBg: "rgba(35,31,32,0.03)",
    inputBorder: "rgba(35,31,32,0.2)",
    inputFocusBorder: color,
    inputText: BRAND.colors.ink,
    inputPlaceholder: "#8A8689",
    overlayBg: "rgba(20,19,22,0.55)",
    cancelBg: "transparent",
    cancelBorder: "rgba(35,31,32,0.35)",
    cancelText: BRAND.colors.ink,
    submitBg: BRAND.colors.primary,
    submitText: "#fff",
  };
}

const MODAL_THEMES: Record<string, ModalTheme> = Object.fromEntries(
  Object.values(GROUPS).map((g) => [g.slug, makeModalTheme(g.color)])
);

const DEFAULT_THEME: ModalTheme = makeModalTheme(BRAND.colors.primary);

function generateAutoName(desc: string): string {
  if (desc.length <= 50) return desc;
  return desc.slice(0, 50).trim() + "...";
}

export default function AddIdeaModal({ teamId, teamSlug, category, onClose, onSuccess, onAddLocal }: AddIdeaModalProps) {
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addFailed, setAddFailed] = useState(false);
  const [showFramework, setShowFramework] = useState(false);
  const [framework, setFramework] = useState({
    bbei_connection: "",
    key_partners: "",
  });
  const [enabledFields, setEnabledFields] = useState<string[]>(["wave", "bbei_connection", "key_partners"]);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const theme = (teamSlug && MODAL_THEMES[teamSlug]) || DEFAULT_THEME;

  useEffect(() => {
    supabase.from("workshop_settings").select("value").eq("key", "enabled_idea_fields").single()
      .then(({ data }) => {
        if (data?.value) try { setEnabledFields(JSON.parse(data.value)); } catch {}
      });
  }, []);

  const hasFrameworkNotes = Object.values(framework).some((v) => v.trim());

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);

    // Read directly from DOM to avoid React state batching race on Enter key
    const currentName = nameRef.current?.value ?? name;
    const ideaName = currentName.trim() || generateAutoName(description.trim());
    const ideaDesc = description.trim();

    if (onAddLocal) {
      onAddLocal(ideaName, ideaDesc);
      onClose();
      return;
    }

    const insertData: Record<string, string> = {
      team_id: teamId,
      category,
      name: ideaName,
      description: ideaDesc,
    };

    // Include framework fields if any were filled
    if (hasFrameworkNotes) {
      if (framework.bbei_connection.trim()) insertData.bbei_connection = framework.bbei_connection.trim();
      if (framework.key_partners.trim()) insertData.key_partners = framework.key_partners.trim();
    }

    const r = await write("ideas.insert:add-idea", supabase.from("ideas").insert(insertData));

    if (!r.ok) {
      // The modal stays open with every word in it. A capture surface
      // that closes on a failed write has destroyed the idea it existed
      // to take.
      setAddFailed(true);
      setSubmitting(false);
      return;
    }
    setAddFailed(false);

    // Reset for another idea
    setDescription("");
    setName("");
    setFramework({ bbei_connection: "", key_partners: "" });
    setShowFramework(false);
    setSubmitting(false);
    onSuccess?.();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Nothing typed here is saved anywhere until "Add it" — a dismissal bins it.
  const hasContent = !!(description.trim() || name.trim() || hasFrameworkNotes);

  // Esc closes. It did nothing before, which left the participant's reflex dead
  // while a stray backdrop click silently binned a typed idea — exactly
  // backwards. Esc now releases the field first (one press), then closes the
  // modal (two), the same contract the board card already keeps.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      const editable = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      e.preventDefault();
      e.stopPropagation();
      if (editable) { t.blur(); return; }
      onClose();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  const categoryColor = PILLARS[category]?.color || "#8A8689";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: theme.overlayBg }}
      // An empty modal still closes on a click outside. A modal with a typed
      // idea in it does not: the backdrop is the easiest surface in the room to
      // hit by accident, and it was throwing the idea away with no undo and no
      // trace. Cancel and Esc remain the deliberate ways out.
      onClick={() => { if (!hasContent) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.94, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 16, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="dove-modal relative w-full p-8"
        style={{
          background: theme.bg,
          border: "1px solid rgba(35,31,32,0.14)",
          maxWidth: showFramework ? "44rem" : "28rem",
          transition: "max-width 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* The gold hairline — the engagement's mark on the panel */}
        <span aria-hidden className="dove-modal-hairline" />
        <h3
          className="font-display text-[34px] mb-2"
          style={{ color: theme.text }}
        >
          A new idea
        </h3>
        <div
          className="font-bold text-[12px] tracking-[3px] uppercase mb-8"
          style={{ color: categoryColor }}
        >
          {PILLARS[category]?.label || category}
        </div>

        <div className="space-y-4">
          {/* Primary: the idea */}
          <div>
            <label
              className="font-bold text-[12px] tracking-[3px] uppercase mb-3 block"
              style={{ color: theme.labelColor }}
            >
              The idea
            </label>
            <textarea
              ref={descRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's the idea? One honest sentence is enough to start."
              rows={3}
              className="w-full px-5 py-4 text-[19px] leading-[1.5] focus:outline-none resize-none transition-colors"
              style={{
                background: theme.inputBg,
                border: `1px solid ${theme.inputBorder}`,
                color: theme.inputText,
              }}
              autoFocus
            />
          </div>

          {/* Secondary: optional name */}
          <div>
            <label
              className="font-bold text-[12px] tracking-[3px] uppercase mb-3 block"
              style={{ color: theme.labelColor, opacity: 0.5 }}
            >
              Name it (optional)
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
                handleKeyDown(e);
              }}
              placeholder="A working name is fine — better names come later."
              className="w-full px-5 py-3.5 text-[17px] focus:outline-none transition-colors"
              style={{
                background: theme.inputBg,
                border: `1px solid ${theme.inputBorder}`,
                color: theme.inputText,
              }}
            />
          </div>

          {/* Expandable framework notes — only show if any fields are enabled */}
          {FRAMEWORK_FIELDS.some(f => f.key !== "wave" && enabledFields.includes(f.key)) && <div>
            <button
              onClick={() => setShowFramework(!showFramework)}
              className="font-bold text-[12px] tracking-[3px] uppercase flex items-center gap-2 transition-colors cursor-pointer py-1"
              style={{ color: theme.labelColor, opacity: 0.5 }}
            >
              {showFramework ? "▾" : "▸"} Framework notes
            </button>

            <AnimatePresence>
              {showFramework && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-3 pt-3">
                    {FRAMEWORK_FIELDS.filter(f => f.key !== "wave" && enabledFields.includes(f.key)).map(({ key, label, prompt }) => (
                      <div key={key}>
                        <label
                          className="font-bold text-[11px] tracking-[2px] uppercase mb-2 block"
                          style={{ color: theme.labelColor, opacity: 0.5 }}
                        >
                          {label}
                        </label>
                        <textarea
                          value={framework[key as keyof typeof framework] || ""}
                          onChange={(e) => setFramework((f) => ({ ...f, [key]: e.target.value }))}
                          onKeyDown={handleKeyDown}
                          placeholder={prompt}
                          rows={2}
                          className="w-full px-4 py-3 text-[15px] leading-relaxed focus:outline-none resize-none transition-colors"
                          style={{
                            background: theme.inputBg,
                            border: `1px solid ${theme.inputBorder}`,
                            color: theme.inputText,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>}
        </div>

        {/* The board did not take it. One line, in the micro-register,
            above the action that failed — and every word the
            participant typed is still in the fields behind it. */}
        {addFailed && (
          <p
            data-qa="add-idea-failed"
            className="slug text-[11px] mt-6 -mb-3"
            style={{ color: BRAND.colors.primary }}
          >
            Not added · your idea is still here. Try again.
          </p>
        )}

        {/* Actions — the Dove pill pair */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="dove-modal-cancel flex-1 font-bold text-[13px] uppercase tracking-[1.5px] py-3.5 cursor-pointer"
          >
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            disabled={!description.trim() || submitting}
            className="flex-1 font-bold text-[13px] uppercase tracking-[1.5px] py-3.5 disabled:opacity-30 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #002663 0%, #0A3478 100%)",
              color: "#fff",
              borderRadius: 999,
              boxShadow: !description.trim() ? "none" : "0 6px 22px rgba(0,38,99,0.3)",
              transition: "box-shadow 0.25s ease",
            }}
          >
            {submitting ? "Adding…" : "Add it →"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
