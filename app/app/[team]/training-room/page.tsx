"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, isShowcaseMode } from "@/lib/supabase";
import { write } from "@/lib/db";
import { Idea, Coach } from "@/lib/types";
import { COACHES } from "@/lib/coaches";
import { SHOWCASE_COACH_REPLIES } from "@/lib/showcase-data";
import { GROUPS, BRAND, FRAMEWORK_FIELDS as CONFIG_FRAMEWORK_FIELDS, PAGE_NAMES } from "@/lib/config";
import AmbientField from "@/components/AmbientField";

const TEAM_CONFIG: Record<string, { name: string; color: string }> = Object.fromEntries(
  Object.values(GROUPS).map((g) => [g.slug, { name: g.name, color: g.color }])
);

// Key lookups, not positional indexes (D-9 seam): reordering
// FRAMEWORK_FIELDS in config must never silently relabel the field a
// coach is editing. The keys are DB column names and stay put.
const configField = (key: "bbei_connection" | "key_partners") => {
  const f = CONFIG_FRAMEWORK_FIELDS.find((cf) => cf.key === key);
  if (!f) throw new Error(`FRAMEWORK_FIELDS is missing '${key}' — the coaching room edits this DB column by name.`);
  return f;
};

const FRAMEWORK_FIELDS = (["bbei_connection", "key_partners"] as const).map((key) => {
  const f = configField(key);
  return { key, label: f.label, prompt: f.prompt };
});

type FrameworkKey = "bbei_connection" | "key_partners";

const INK = "#231F20";
const RED = BRAND.colors.primary;
const MUTED = "#8A8689";
const HAIRLINE = "rgba(35, 31, 32, 0.18)";
const HAIRLINE_STRONG = "rgba(35, 31, 32, 0.35)";
const PANEL = "#EDEDED";

interface Message {
  role: "user" | "coach";
  content: string;
  coachType?: string;
  messageType?: "voice" | "provocation" | "draft" | "system";
  draftField?: string;
}

// ── Placeholder safety (D-6) ────────────────────────────────
// /api/coach refuses a prompt that still carries bracket tokens. That
// refusal is a CONFIGURATION fact, not a transient model hiccup — it
// must reach the room in the route's own words, never be papered over
// by the scripted showcase fallback.
class CoachConfigError extends Error {}

async function throwCoachError(response: Response): Promise<never> {
  const body = await response.json().catch(() => null);
  if (body?.code === "placeholder_tokens" && body?.error) throw new CoachConfigError(body.error);
  throw new Error("Coach unavailable");
}

function TrainingCenterContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamSlug = params.team as string;
  const ideaId = searchParams.get("idea");
  const config = TEAM_CONFIG[teamSlug];

  const [idea, setIdea] = useState<Idea | null>(null);
  const [ideaMissing, setIdeaMissing] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Partial<Idea>>({});
  const [briefContext, setBriefContext] = useState<string | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [messagesByCoach, setMessagesByCoach] = useState<Record<string, Message[]>>({});
  const [userInput, setUserInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "failed" | "idle">("idle");
  const [undoStack, setUndoStack] = useState<{ field: FrameworkKey; previousValue: string }[]>([]);

  const [showCoachSwitcher, setShowCoachSwitcher] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const voiceEndRef = useRef<HTMLDivElement>(null);
  const streamingStartRef = useRef<HTMLDivElement>(null);
  const wasStreamingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show intro overlay only if never seen before
  useEffect(() => {
    if (!localStorage.getItem("trainingRoomIntroSeen")) {
      setShowIntro(true);
    }
  }, []);

  const dismissIntro = (coach?: Coach) => {
    localStorage.setItem("trainingRoomIntroSeen", "1");
    setShowIntro(false);
    if (coach) handleSelectCoach(coach);
  };

  // Close switcher on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowCoachSwitcher(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Fetch idea + its team's brief in one query
  useEffect(() => {
    if (!ideaId) {
      setIdeaMissing(true);
      return;
    }
    async function fetchIdeaAndBrief() {
      const { data } = await supabase
        .from("ideas")
        .select("*")
        .eq("id", ideaId)
        .single();
      if (data) {
        setIdea(data as Idea);
        setEditingIdea({
          name: data.name,
          description: data.description,
          bbei_connection: data.bbei_connection,
          key_partners: data.key_partners,
        });
        setSaveStatus("saved");

        // Fetch pillar brief from category_briefs
        const { data: briefData } = await supabase
          .from("category_briefs")
          .select("brief_context")
          .eq("category", data.category)
          .single();
        if (briefData?.brief_context) {
          setBriefContext(briefData.brief_context);
        }
      } else {
        setIdeaMissing(true);
      }
    }
    fetchIdeaAndBrief();
  }, [ideaId]);

  // Scroll to bottom when coach changes
  useEffect(() => {
    voiceEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedCoach]);

  // When streaming starts, scroll to the top of the new response — not the bottom
  useEffect(() => {
    if (isStreaming && !wasStreamingRef.current) {
      streamingStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Debounced auto-save
  const saveToSupabase = useCallback(
    async (fields: Partial<Idea>) => {
      if (!ideaId) return;
      setSaveStatus("saving");
      // U7: this surface was already field-level — `handleFieldChange`
      // sends `{ [field]: value }` — so it needs only the stamp and the
      // failed truth. The rewrite stays in the textarea either way.
      const r = await write(
        "ideas.update:training-autosave",
        supabase
          .from("ideas")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", ideaId)
      );
      if (r.ok) {
        setSaveStatus("saved");
        setIdea((prev) => (prev ? { ...prev, ...fields } : prev));
      } else {
        setSaveStatus("failed");
      }
    },
    [ideaId]
  );

  const handleFieldChange = (field: FrameworkKey | "name" | "description", value: string) => {
    setEditingIdea((prev) => ({ ...prev, [field]: value }));
    setSaveStatus("idle");

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToSupabase({ [field]: value });
    }, 800);
  };

  // Get current messages for selected coach
  const currentMessages = selectedCoach
    ? messagesByCoach[selectedCoach.type] || []
    : [];

  // Scripted showcase reply — typed in like a live response when /api/coach
  // has no key behind it. Saves through the same path as a real exchange.
  const deliverScriptedReply = async (coach: Coach, prompt: string, priorMessages: Message[]): Promise<boolean> => {
    const scripted = SHOWCASE_COACH_REPLIES[coach.type];
    if (!scripted || !idea) return false;
    const signal = abortControllerRef.current?.signal;

    await new Promise((r) => setTimeout(r, 900));
    if (signal?.aborted) return true;

    const words = scripted.split(" ");
    let shown = "";
    for (const word of words) {
      if (signal?.aborted) return true;
      shown = shown ? `${shown} ${word}` : word;
      setStreamingText(shown);
      await new Promise((r) => setTimeout(r, 18));
    }

    const coachMessage: Message = {
      role: "coach",
      content: scripted,
      coachType: coach.type,
      messageType: "voice",
    };
    setMessagesByCoach((prev) => ({
      ...prev,
      [coach.type]: [...priorMessages, coachMessage],
    }));
    setStreamingText("");
    setIsStreaming(false);

    const note = await write(
      "training_notes.insert:exchange",
      supabase.from("training_notes").insert({
        idea_id: idea.id,
        coach_type: coach.type,
        user_prompt: prompt,
        ai_response: scripted,
      })
    );

    // The record first, the stamp only if the record took.
    if (note.ok && idea.status === "draft") {
      const marked = await write(
        "ideas.update:coached",
        supabase.from("ideas").update({ status: "coached", updated_at: new Date().toISOString() }).eq("id", idea.id)
      );
      if (marked.ok) setIdea((prev) => prev ? { ...prev, status: "coached" } : prev);
    }
    return true;
  };

  const handleSendMessage = async (customPrompt?: string) => {
    if (!selectedCoach || !idea) return;
    const prompt = customPrompt || userInput.trim();
    if (!prompt) return;

    const coachType = selectedCoach.type;
    const userMessage: Message = { role: "user", content: prompt };
    const prevMessages = messagesByCoach[coachType] || [];
    const updatedMessages = [...prevMessages, userMessage];

    setMessagesByCoach((prev) => ({ ...prev, [coachType]: updatedMessages }));
    setUserInput("");
    setIsStreaming(true);
    setStreamingText("");
    voiceEndRef.current?.scrollIntoView({ behavior: "smooth" });

    try {
      abortControllerRef.current = new AbortController();
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          coachType: selectedCoach.type,
          ideaName: editingIdea.name || idea.name,
          ideaDescription: editingIdea.description || idea.description,
          ideaCategory: idea.category,
          ideaFramework: {
            bbei_connection: editingIdea.bbei_connection || idea?.bbei_connection || "",
            key_partners: editingIdea.key_partners || idea?.key_partners || "",
          },
          teamName: config?.name,
          // /api/coach loads the team's creative platform by SLUG. Without
          // it every live reply calls the platform "the creative platform".
          teamSlug,
          briefContext: briefContext || undefined,
          prompt,
          conversationHistory: updatedMessages
            .filter((m) => m !== userMessage)
            .map((m) => ({
              role: m.role === "coach" ? "assistant" : "user",
              content: m.content,
            })),
        }),
      });

      if (!response.ok) await throwCoachError(response);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamingText(fullText);
        }
      }

      const coachMessage: Message = {
        role: "coach",
        content: fullText,
        coachType: selectedCoach.type,
        messageType: "voice",
      };

      setMessagesByCoach((prev) => ({
        ...prev,
        [coachType]: [...updatedMessages, coachMessage],
      }));

      setStreamingText("");
      setIsStreaming(false);

      const note = await write(
        "training_notes.insert:exchange",
        supabase.from("training_notes").insert({
          idea_id: idea.id,
          coach_type: selectedCoach.type,
          user_prompt: prompt,
          ai_response: fullText,
        })
      );

      // The record comes first and the stamp only follows it. A COACHED
      // stamp the training_notes count cannot see is the disagreement
      // the Newsroom's marquee metric is measured on.
      // Mark idea as trained after first coaching session
      if (note.ok && idea.status === "draft") {
        const marked = await write(
          "ideas.update:coached",
          supabase.from("ideas").update({ status: "coached", updated_at: new Date().toISOString() }).eq("id", idea.id)
        );
        if (marked.ok) setIdea((prev) => prev ? { ...prev, status: "coached" } : prev);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setIsStreaming(false);
        setStreamingText("");
        return;
      }
      if (err instanceof CoachConfigError) {
        setIsStreaming(false);
        setStreamingText("");
        setMessagesByCoach((prev) => ({
          ...prev,
          [coachType]: [...updatedMessages, { role: "coach", content: err.message, coachType: selectedCoach.type, messageType: "system" } as Message],
        }));
        return;
      }
      const handled = await deliverScriptedReply(selectedCoach, prompt, updatedMessages).catch(() => false);
      if (handled) return;
      setIsStreaming(false);
      setStreamingText("");
      const errorMessage: Message = {
        role: "coach",
        content: "Taking a moment — tap Send again to retry.",
        coachType: selectedCoach.type,
        messageType: "system",
      };
      setMessagesByCoach((prev) => ({
        ...prev,
        [coachType]: [...updatedMessages, errorMessage],
      }));
    }
  };

  const handleSelectCoach = (coach: Coach) => {
    if (isStreaming) return;
    setSelectedCoach(coach);

    // If no messages exist for this coach, send intro
    if (!messagesByCoach[coach.type]?.length && idea) {
      // Need to set the coach first, then trigger message
      setTimeout(() => {
        handleSendMessageForCoach(coach, "Give us your first read on this idea.");
      }, 100);
    }
  };

  // Separate function to send with a specific coach (for auto-intro)
  const handleSendMessageForCoach = async (coach: Coach, prompt: string) => {
    if (!idea) return;

    const coachType = coach.type;
    const userMessage: Message = { role: "user", content: prompt };
    const updatedMessages = [userMessage];

    setMessagesByCoach((prev) => ({ ...prev, [coachType]: updatedMessages }));
    setIsStreaming(true);
    setStreamingText("");
    voiceEndRef.current?.scrollIntoView({ behavior: "smooth" });

    try {
      abortControllerRef.current = new AbortController();
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          coachType: coach.type,
          ideaName: editingIdea.name || idea.name,
          ideaDescription: editingIdea.description || idea.description,
          ideaCategory: idea.category,
          ideaFramework: {
            bbei_connection: editingIdea.bbei_connection || idea?.bbei_connection || "",
            key_partners: editingIdea.key_partners || idea?.key_partners || "",
          },
          teamName: config?.name,
          teamSlug,
          briefContext: briefContext || undefined,
          prompt,
          conversationHistory: [],
        }),
      });

      if (!response.ok) await throwCoachError(response);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamingText(fullText);
        }
      }

      const coachMessage: Message = {
        role: "coach",
        content: fullText,
        coachType: coach.type,
        messageType: "voice",
      };

      setMessagesByCoach((prev) => ({
        ...prev,
        [coachType]: [...updatedMessages, coachMessage],
      }));

      setStreamingText("");
      setIsStreaming(false);

      const note = await write(
        "training_notes.insert:exchange",
        supabase.from("training_notes").insert({
          idea_id: idea.id,
          coach_type: coach.type,
          user_prompt: prompt,
          ai_response: fullText,
        })
      );

      // The record comes first and the stamp only follows it. A COACHED
      // stamp the training_notes count cannot see is the disagreement
      // the Newsroom's marquee metric is measured on.
      // Mark idea as trained after first coaching session
      if (note.ok && idea.status === "draft") {
        const marked = await write(
          "ideas.update:coached",
          supabase.from("ideas").update({ status: "coached", updated_at: new Date().toISOString() }).eq("id", idea.id)
        );
        if (marked.ok) setIdea((prev) => prev ? { ...prev, status: "coached" } : prev);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setIsStreaming(false);
        setStreamingText("");
        return;
      }
      if (err instanceof CoachConfigError) {
        setIsStreaming(false);
        setStreamingText("");
        setMessagesByCoach((prev) => ({
          ...prev,
          [coachType]: [...updatedMessages, { role: "coach", content: err.message, coachType: coach.type, messageType: "system" } as Message],
        }));
        return;
      }
      const handled = await deliverScriptedReply(coach, prompt, updatedMessages).catch(() => false);
      if (handled) return;
      setIsStreaming(false);
      setStreamingText("");
      const errorMessage: Message = {
        role: "coach",
        content: "Taking a moment — tap Send again to retry.",
        coachType: coach.type,
        messageType: "system",
      };
      setMessagesByCoach((prev) => ({
        ...prev,
        [coachType]: [...updatedMessages, errorMessage],
      }));
    }
  };

  // Apply draft suggestion to canvas
  const applyDraftToCanvas = (field: FrameworkKey, newValue: string) => {
    const previousValue = (editingIdea[field] as string) || "";
    setUndoStack((prev) => [...prev, { field, previousValue }]);
    handleFieldChange(field, newValue);

    // Auto-clear undo after 5s
    setTimeout(() => {
      setUndoStack((prev) => prev.filter((u) => u.field !== field || u.previousValue !== previousValue));
    }, 5000);
  };

  const handleUndo = () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    handleFieldChange(last.field, last.previousValue);
    setUndoStack((prev) => prev.slice(0, -1));
  };

  if (!config) return null;

  const coachRoundCount = currentMessages.filter((m) => m.role === "coach" && m.messageType !== "system").length;

  const renderWithBold = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      if (match[1] !== undefined) {
        parts.push(<strong key={match.index} style={{ color: INK, fontWeight: 700 }}>{match[1]}</strong>);
      } else if (match[2] !== undefined) {
        parts.push(<em key={match.index} style={{ fontStyle: "italic" }}>{match[2]}</em>);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ bottom: 48, background: "#FFFFFF", color: INK }}
    >
      {/* Header */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="sticky top-0 z-40 px-8 flex-shrink-0"
        style={{
          background: "#FFFFFF",
          borderBottom: `2px solid ${config.color}`,
        }}
      >
        <div className="flex items-center justify-between py-[10px]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/${teamSlug}`)}
              className="font-sans font-[700] text-[11px] tracking-[2px] uppercase bg-transparent border-none cursor-pointer transition-colors"
              style={{ color: MUTED }}
              onMouseEnter={(e) => { e.currentTarget.style.color = INK; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = MUTED; }}
            >
              &larr; The Board
            </button>
            <div className="w-px h-5" style={{ background: HAIRLINE }} />
            <span className="font-display text-[17px]" style={{ color: INK }}>
              {PAGE_NAMES.coachRoom}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Save indicator */}
            <span
              data-qa="training-autosave-slug"
              data-state={saveStatus}
              className="slug flex items-center gap-[6px]"
              style={{ color: saveStatus === "failed" ? RED : saveStatus === "saving" ? MUTED : INK }}
            >
              <span
                className="w-[5px] h-[5px] rounded-full inline-block"
                style={{ background: saveStatus === "saving" ? MUTED : INK }}
              />
              {saveStatus === "failed"
                ? "Not saved · Retry"
                : saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "saved"
                    ? (isShowcaseMode ? "Saved for this session" : "Saved")
                    : ""}
            </span>
            <div className="w-px h-5" style={{ background: HAIRLINE }} />
            <button
              className="font-sans font-[700] text-[10px] tracking-[2px] uppercase px-[14px] py-[7px] border-none text-white cursor-pointer"
              style={{ background: INK }}
              onClick={() => saveToSupabase(editingIdea)}
            >
              Save
            </button>
          </div>
        </div>
      </motion.header>

      {!idea && ideaMissing ? (
        /* Direct navigation with nothing loaded — a note instead of a dead room */
        <div className="flex flex-1 items-center justify-center px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="text-center max-w-[460px] px-10 py-12"
            style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}`, borderRadius: 2 }}
          >
            <p className="font-display text-[24px] leading-[1.4] mb-7" style={{ color: INK, textWrap: "balance" } as React.CSSProperties}>
              Pick an idea from The Board and it opens here for coaching.
            </p>
            <button
              onClick={() => router.push(`/${teamSlug}`)}
              className="font-sans font-[700] text-[11px] tracking-[2px] uppercase px-5 py-3 cursor-pointer bg-transparent transition-colors"
              style={{ border: `1px solid ${HAIRLINE_STRONG}`, color: INK }}
            >
              &larr; Back to The Board
            </button>
          </motion.div>
        </div>
      ) : (
      /* Main split layout */
      <div className="flex flex-1 min-h-0 relative z-10">
        {/* Left: the manuscript */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 flex flex-col min-h-0"
          style={{ borderRight: `1px solid ${HAIRLINE}`, padding: "12px 28px 0" }}
        >
          {/* Name row */}
          <div className="flex-shrink-0 flex items-baseline gap-3 pb-[10px] mb-[10px]" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            <label
              className="font-sans font-[700] text-[11px] tracking-[2px] uppercase flex-shrink-0"
              style={{ color: MUTED }}
            >
              Name
            </label>
            <input
              className="flex-1 bg-transparent border-none font-display text-[30px] outline-none"
              style={{ color: INK }}
              value={editingIdea.name || ""}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              placeholder="Give it a name."
            />
          </div>

          {/* Framework grid: description (left) + framework fields stacked (right) */}
          <div className="flex-1 grid grid-cols-[2fr_1fr] min-h-0">
            {/* Left: Idea / Description */}
            <div className="flex flex-col min-h-0" style={{ borderRight: `1px solid ${HAIRLINE}` }}>
              <div
                className="font-sans font-[700] text-[11px] tracking-[2px] uppercase flex-shrink-0"
                style={{ color: MUTED, padding: "14px 18px 2px" }}
              >
                Idea
              </div>
              <textarea
                className="flex-1 w-full bg-transparent border-none font-sans text-[19px] leading-[1.7] outline-none resize-none min-h-0"
                style={{ color: INK, padding: "6px 18px 14px" }}
                value={editingIdea.description || ""}
                onChange={(e) => handleFieldChange("description", e.target.value)}
                placeholder="Say what it is. Two or three sentences is plenty."
              />
            </div>

            {/* Right: framework fields stacked */}
            <div className="flex flex-col min-h-0">
              {FRAMEWORK_FIELDS.map((field, i) => (
                <div
                  key={field.key}
                  className="flex flex-col min-h-0"
                  style={{
                    flex: 1,
                    borderBottom: i === 0 ? `1px solid ${HAIRLINE}` : "none",
                  }}
                >
                  <div
                    className="font-sans font-[700] text-[11px] tracking-[2px] uppercase flex-shrink-0"
                    style={{ color: MUTED, padding: "14px 18px 2px" }}
                  >
                    {field.label}
                  </div>
                  <textarea
                    className="flex-1 w-full bg-transparent border-none font-sans text-[15px] leading-[1.65] outline-none resize-none min-h-0"
                    style={{ color: INK, padding: "6px 18px 14px" }}
                    value={(editingIdea[field.key] as string) || ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.prompt}
                  />
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right: the coaching exchange */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col min-h-0 flex-shrink-0"
          style={{ width: 420, background: PANEL }}
        >
          {/* Voice area — relative container, children absolutely positioned */}
          <div className="flex-1 relative min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
            {!selectedCoach ? (
              /* Coach selection — the department masthead */
              <motion.div
                key="coach-selection"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto"
                style={{ paddingLeft: 24, paddingRight: 24, scrollbarWidth: "none" }}
              >
                <div className="flex flex-col gap-[10px]" style={{ paddingTop: 24, paddingBottom: 24 }}>
                <div className="text-center mb-3">
                  <div className="font-display text-[26px]" style={{ color: INK }}>
                    Pick a Coach
                  </div>
                  <div className="font-sans text-[14px] mt-1" style={{ color: MUTED }}>
                    Each brings a different lens to your idea
                  </div>
                </div>
                {COACHES.map((coach, idx) => (
                  <motion.button
                    key={coach.type}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.08 }}
                    onClick={() => handleSelectCoach(coach)}
                    className="coach-card flex items-center gap-4 text-left cursor-pointer"
                    style={{
                      padding: "14px 16px",
                      background: "#FFFFFF",
                      border: `1px solid rgba(48,51,52,0.15)`,
                      borderLeft: `3px solid ${coach.color}`,
                      borderRadius: 14,
                    }}
                  >
                    <img src={coach.avatar} alt={coach.name} width={56} height={56} className="w-[56px] h-[56px] flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-display text-[20px]" style={{ color: INK }}>
                        {coach.name}
                      </div>
                      <div className="font-sans italic text-[13px] mt-[2px]" style={{ color: MUTED }}>
                        {coach.title}
                      </div>
                      <div className="font-sans text-[14px] mt-[4px] leading-[1.45]" style={{ color: "#5C585A" }}>
                        {coach.shortDescription}
                      </div>
                    </div>
                  </motion.button>
                ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={"conversation-" + selectedCoach.type}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col"
              >
                {/* Banner */}
                <div
                  className="flex-shrink-0 flex items-center gap-3"
                  style={{
                    padding: "14px 20px",
                    height: 76,
                    background: "#FFFFFF",
                    borderBottom: `1px solid ${HAIRLINE}`,
                  }}
                >
                  <button
                    onClick={() => {
                      abortControllerRef.current?.abort();
                      setIsStreaming(false);
                      setStreamingText("");
                      setSelectedCoach(null);
                    }}
                    className="font-mono text-[22px] cursor-pointer transition-colors flex-shrink-0"
                    style={{ color: MUTED }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = INK; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = MUTED; }}
                    title="Back to coach selection"
                  >
                    &lsaquo;
                  </button>
                  <motion.div
                    key={selectedCoach.avatar}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                    className="flex-shrink-0"
                  >
                    <img src={selectedCoach.avatar} alt={selectedCoach.name} width={46} height={46} className="w-[46px] h-[46px]" />
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[18px]" style={{ color: INK }}>
                      {selectedCoach.name}
                    </div>
                    <div className="font-sans italic text-[12px] mt-[1px] truncate" style={{ color: MUTED }}>
                      {selectedCoach.title}
                    </div>
                  </div>
                  {/* Coach switcher dropdown */}
                  <div className="relative flex-shrink-0" ref={switcherRef}>
                    <button
                      onClick={() => setShowCoachSwitcher((v) => !v)}
                      disabled={isStreaming}
                      title="Switch coach"
                      className="flex flex-col gap-[5px] items-center justify-center cursor-pointer disabled:opacity-40 transition-opacity"
                      style={{ width: 32, height: 32, background: "#FFFFFF", border: `1px solid ${HAIRLINE_STRONG}`, borderRadius: 2 }}
                    >
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-[14px] h-[2px] rounded-full" style={{ background: MUTED }} />
                      ))}
                    </button>
                    {showCoachSwitcher && (
                      <div
                        className="absolute right-0 top-[38px] z-50 flex flex-col gap-1 p-2"
                        style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}`, borderRadius: 14, minWidth: 210, boxShadow: "0 2px 14px rgba(35,31,32,0.14)" }}
                      >
                        {COACHES.filter((c) => c.type !== selectedCoach.type).map((coach) => {
                          const hasHistory = !!messagesByCoach[coach.type]?.length;
                          return (
                            <button
                              key={coach.type}
                              onClick={() => { handleSelectCoach(coach); setShowCoachSwitcher(false); }}
                              className="flex items-center gap-3 text-left cursor-pointer transition-colors duration-150 px-3 py-2 hover:bg-[#F4F3F2]"
                              style={{ background: "transparent", borderRadius: 2 }}
                            >
                              <img src={coach.avatar} alt={coach.name} width={30} height={30} className="w-[30px] h-[30px] flex-shrink-0" />
                              <div>
                                <div className="font-display text-[14px]" style={{ color: INK }}>{coach.name}</div>
                                <div className="font-sans italic text-[11px]" style={{ color: MUTED }}>{coach.title}</div>
                              </div>
                              {hasHistory && <div className="ml-auto w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: INK }} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {/* The exchange */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-4" style={{ padding: "18px 20px" }}>
                {currentMessages.length === 0 && !isStreaming ? (
                  <div className="flex-1 flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                      <img src={selectedCoach.avatar} alt={selectedCoach.name} width={48} height={48} className="w-[48px] h-[48px]" />
                      <div className="flex items-center gap-2">
                        {[0, 0.15, 0.3].map((delay, i) => (
                          <motion.div
                            key={i}
                            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay }}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: MUTED }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                {currentMessages.map((msg, i) => {
                  const round = currentMessages
                    .slice(0, i + 1)
                    .filter((m) => m.role === "coach" && m.messageType !== "system").length;
                  return (
                  <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
                    {msg.role === "user" ? (
                      /* The team speaks in the interface voice */
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="max-w-[85%]"
                        style={{
                          padding: "10px 14px",
                          background: "#FFFFFF",
                          border: `1px solid ${config.color}55`,
                          borderRadius: "8px 8px 2px 8px",
                        }}
                      >
                        <p className="font-sans text-[14px] leading-[1.55]" style={{ color: INK }}>{msg.content}</p>
                      </motion.div>
                    ) : msg.messageType === "system" ? (
                      <div className="font-sans italic text-[13px]" style={{ color: MUTED }}>
                        {msg.content}
                      </div>
                    ) : (
                      /* The coach types on the deck */
                      <div style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}`, borderRadius: 14, padding: "14px 18px 18px" }}>
                        <div className="slug flex items-baseline gap-[6px] mb-3 pb-[8px]" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                          <span style={{ color: RED }}>{selectedCoach.name}</span>
                          <span style={{ color: MUTED }}>&middot; Round {round}</span>
                        </div>
                        <div className="font-mono text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: INK }}>
                          {renderWithBold(msg.content)}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}

                {/* Streaming response — the page being typed */}
                {isStreaming && (
                  <motion.div
                    ref={streamingStartRef}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}`, borderRadius: 14, padding: "14px 18px 18px" }}
                  >
                    <div className="slug flex items-baseline gap-[6px] mb-3 pb-[8px]" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                      <span style={{ color: RED }}>{selectedCoach.name}</span>
                      <span style={{ color: MUTED }}>&middot; Round {coachRoundCount + 1}</span>
                    </div>
                    {streamingText ? (
                      <div className="font-mono text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: INK }}>
                        {renderWithBold(streamingText)}
                        <motion.span
                          animate={{ opacity: [1, 0.2, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="inline-block w-[7px] h-[14px] ml-[3px] align-middle"
                          style={{ backgroundColor: INK }}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-1">
                        {[0, 0.15, 0.3].map((delay, i) => (
                          <motion.div
                            key={i}
                            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay }}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: MUTED }}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
                <div ref={voiceEndRef} />
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>

          {/* Undo toast */}
          <AnimatePresence>
            {undoStack.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex-shrink-0 flex items-center justify-between mx-5 mb-2 px-4 py-2"
                style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}`, borderRadius: 2 }}
              >
                <span className="font-sans text-[12px]" style={{ color: MUTED }}>
                  Applied to {FRAMEWORK_FIELDS.find((f) => f.key === undoStack[undoStack.length - 1].field)?.label}
                </span>
                <button
                  onClick={handleUndo}
                  className="font-sans font-[700] text-[10px] tracking-[2px] uppercase px-3 py-1 cursor-pointer bg-transparent transition-colors"
                  style={{ border: `1px solid ${HAIRLINE_STRONG}`, color: INK }}
                >
                  Undo
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input bar — always rendered to prevent layout shift */}
          <div
            className="flex-shrink-0 flex gap-[10px] transition-opacity duration-200"
            style={{
              padding: "12px 20px",
              borderTop: `1px solid ${HAIRLINE}`,
              background: "#FFFFFF",
              opacity: selectedCoach ? 1 : 0,
              pointerEvents: selectedCoach ? "auto" : "none",
            }}
          >
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isStreaming && handleSendMessage()}
              placeholder="Respond to the coach..."
              disabled={isStreaming || !selectedCoach}
              className="flex-1 font-sans text-[14px] outline-none disabled:opacity-50 transition-colors px-4 py-3"
              style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE_STRONG}`, borderRadius: 14, color: INK }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isStreaming || !userInput.trim() || !selectedCoach}
              className="font-sans font-[700] text-[11px] tracking-[2px] uppercase px-6 py-3 text-white border-none cursor-pointer disabled:opacity-30"
              style={{
                background: "linear-gradient(135deg, #002663 0%, #0A3478 100%)",
                borderRadius: 999,
                boxShadow: userInput.trim() ? "0 4px 16px rgba(0,38,99,0.3)" : "none",
                transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              Send
            </button>
          </div>
        </motion.div>
      </div>
      )}

      {/* Meet the Coaches — first-visit overlay */}
      <AnimatePresence>
        {showIntro && idea && (
          <motion.div
            key="intro-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{ background: "#F5BAC5", bottom: 48 }}
          >
            <AmbientField preset="blush" opacity={0.35} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(245,186,197,0.55)" }} />
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="relative z-10 text-center mb-10"
            >
              <div className="slug mb-3" style={{ color: INK }}>
                {PAGE_NAMES.coachRoom}
              </div>
              <h1 className="font-display text-[56px] leading-none mb-4" style={{ color: RED }}>
                Meet the Coaches
              </h1>
              <p className="font-sans text-[19px] max-w-[780px] mx-auto leading-[1.6]" style={{ color: INK, textWrap: "balance" } as React.CSSProperties}>
                Pick a coach to sharpen your idea — or ask the Tastemaker how it reads in culture. Each one already knows your category brief and the workshop insights.
              </p>
            </motion.div>

            {/* 2×2 Coach grid */}
            <div className="relative z-10 grid grid-cols-2 gap-5 w-full max-w-[1000px] px-6">
              {COACHES.map((coach, idx) => (
                <motion.button
                  key={coach.type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => dismissIntro(coach)}
                  className="flex items-center gap-6 text-left cursor-pointer transition-colors duration-150"
                  style={{
                    padding: "24px 26px",
                    background: "#FFFFFF",
                    border: `1px solid ${HAIRLINE}`,
                    borderLeft: `3px solid ${coach.color}`,
                    borderRadius: 14
                  }}
                >
                  <img src={coach.avatar} alt={coach.name} width={104} height={104} className="w-[104px] h-[104px] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[26px]" style={{ color: INK }}>
                      {coach.name}
                    </div>
                    <div className="font-sans italic text-[14px] mt-[2px]" style={{ color: MUTED }}>
                      {coach.title}
                    </div>
                    <div className="font-sans text-[15px] mt-[8px] leading-[1.5]" style={{ color: "#5C585A", textWrap: "pretty" } as React.CSSProperties}>
                      {coach.description}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Skip link */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              onClick={() => dismissIntro()}
              className="relative z-10 mt-8 font-sans font-[700] text-[11px] tracking-[2px] uppercase cursor-pointer bg-transparent border-none transition-colors"
              style={{ color: "#57191B" }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = INK; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#57191B"; }}
            >
              Skip — Choose Later
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TrainingCenterPage() {
  return (
    <Suspense fallback={null}>
      <TrainingCenterContent />
    </Suspense>
  );
}
