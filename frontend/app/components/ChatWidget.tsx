"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sendChatMessage } from "@/app/lib/api";

export interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  grounded?: boolean;
  disclaimerAdded?: boolean;
  scholarshipName?: string | null;
  timestamp: string;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeScholarship, setActiveScholarship] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Refs to access latest state without causing stale closures in event handlers
  const activeScholarshipRef = useRef(activeScholarship);
  useEffect(() => {
    activeScholarshipRef.current = activeScholarship;
  }, [activeScholarship]);

  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, loading]);

  const handleSendMessage = useCallback(async (msgText?: string, targetScholarshipId?: string) => {
    const messageToSend = (msgText || inputRef.current).trim();
    if (!messageToSend || loadingRef.current) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: messageToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!msgText) setInput("");
    setLoading(true);

    try {
      const response = await sendChatMessage({
        message: messageToSend,
        scholarship_id: targetScholarshipId || activeScholarshipRef.current?.id || null,
      });

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: response.reply,
        grounded: response.grounded,
        disclaimerAdded: response.disclaimer_added,
        scholarshipName: response.scholarship_name || activeScholarshipRef.current?.name,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      const unreachable = /failed to fetch|networkerror|load failed/i.test(detail);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "bot",
          text: unreachable
            ? "I can't reach the Bursarly service right now, so I can't look anything up. Please check that the assistant server is running and try again."
            : `Sorry, I ran into an issue answering that${detail ? ` (${detail})` : ""}. Please try again in a moment.`,
          disclaimerAdded: false,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep a stable ref to handleSendMessage for the event listener
  const handleSendMessageRef = useRef(handleSendMessage);
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  // Listen for custom event from detail page proactive prompt — registered only once
  useEffect(() => {
    const handleOpenChat = (event: Event) => {
      const customEvent = event as CustomEvent<{ scholarshipId?: string; scholarshipName?: string; initialMessage?: string }>;
      const { scholarshipId, scholarshipName, initialMessage } = customEvent.detail || {};

      if (scholarshipId && scholarshipName) {
        setActiveScholarship({ id: scholarshipId, name: scholarshipName });
      }

      setIsOpen(true);

      if (initialMessage) {
        // Short delay to allow React state updates to flush before sending
        setTimeout(() => {
          handleSendMessageRef.current(initialMessage, scholarshipId || activeScholarshipRef.current?.id);
        }, 150);
      }
    };

    window.addEventListener("open-bursarly-chat", handleOpenChat);
    return () => {
      window.removeEventListener("open-bursarly-chat", handleOpenChat);
    };
  }, []); // Empty: register once only

  // Set default initial greeting when chat opens for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greetingText = activeScholarship
        ? `Hello! Ask me anything about **${activeScholarship.name}** — deadlines, required documents, or eligibility criteria!`
        : "Hello! I am your Bursarly Assistant. Ask me about international scholarships, application deadlines, or how to use the Bursarly tracker!";

      setMessages([
        {
          id: "init-1",
          sender: "bot",
          text: greetingText,
          grounded: !!activeScholarship,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [isOpen, activeScholarship, messages.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickQuestions = activeScholarship
    ? [
        `What is the deadline for ${activeScholarship.name}?`,
        "What documents are required?",
        "What are the eligibility criteria?",
      ]
    : [
        "How do I track application deadlines?",
        "Tell me about Global Korea Scholarship",
        "What do the countdown bar colors mean?",
      ];

  return (
    <>
      {/* Floating Trigger Button (Bottom Right) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#1F3864] hover:bg-[#162A4C] text-white px-4 py-3 rounded-full shadow-lg shadow-[#1F3864]/20 border border-[#2CA6A4]/30 transition-all duration-200"
            aria-label="Open Bursarly Chat Assistant"
          >
            <div className="relative">
              <svg className="w-5 h-5 text-[#2CA6A4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#2CA6A4] rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#2CA6A4] rounded-full" />
            </div>
            <span className="font-medium text-sm hidden sm:inline text-[#F4F1EA]">
              Ask Bursarly AI
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[400px] h-[540px] max-h-[82vh] bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#1F3864] text-white p-4 flex items-center justify-between border-b border-[#2CA6A4]/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#2CA6A4]/20 border border-[#2CA6A4]/40 flex items-center justify-center">
                  <span className="text-base text-[#2CA6A4]">✨</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#F4F1EA] flex items-center gap-1.5">
                    Bursarly Assistant
                  </h3>
                  <p className="text-xs text-teal-200/80 truncate max-w-[200px]">
                    {activeScholarship ? activeScholarship.name : "Verified Scholarship Guidance"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {activeScholarship && (
                  <button
                    onClick={() => setActiveScholarship(null)}
                    title="Clear scholarship context"
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1"
                  >
                    Clear Context
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
                  aria-label="Close chat"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Context Pill Banner (if scholarship context active) */}
            {activeScholarship && (
              <div className="bg-teal-50 border-b border-teal-100 px-3.5 py-1.5 flex items-center justify-between text-xs text-[#1F3864]">
                <span className="truncate font-medium">
                  Context: <strong>{activeScholarship.name}</strong>
                </span>
                <span className="text-[10px] text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full font-semibold">
                  Grounded Mode
                </span>
              </div>
            )}

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F4F1EA]/40">
              {messages.map((msg) => {
                const isUser = msg.sender === "user";
                const isUnverified = !isUser && msg.disclaimerAdded;
                const isGrounded = !isUser && msg.grounded;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    {/* Badge Indicator for Bot Responses */}
                    {!isUser && (
                      <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold">
                        {isGrounded && (
                          <span className="inline-flex items-center gap-1 text-teal-800 bg-teal-100/90 px-2 py-0.5 rounded-full border border-teal-200">
                            <svg className="w-3 h-3 text-[#2CA6A4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Bursarly Verified Data
                          </span>
                        )}
                        {isUnverified && (
                          <span className="inline-flex items-center gap-1 text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                            <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            General Knowledge (Unverified)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Message Content Bubble */}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isUser
                          ? "bg-[#1F3864] text-white rounded-tr-none shadow-sm"
                          : isUnverified
                          ? "bg-amber-500/10 border border-amber-500/30 text-amber-950 rounded-tl-none shadow-sm"
                          : isGrounded
                          ? "bg-white border border-[#2CA6A4]/40 text-slate-800 rounded-tl-none shadow-sm"
                          : "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm"
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.text}</p>
                      <span
                        className={`block text-[10px] mt-1.5 text-right ${
                          isUser ? "text-slate-300" : "text-slate-400"
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>
                  </motion.div>
                );
              })}

              {/* Typing Indicator */}
              {loading && (
                <div className="flex items-center gap-2 text-slate-500 text-xs py-2 px-3 bg-white rounded-2xl border border-slate-200 w-max shadow-sm">
                  <svg className="w-4 h-4 text-[#2CA6A4] animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Searching Bursarly database...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggestion Chips */}
            {messages.length < 4 && !loading && (
              <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="whitespace-nowrap text-xs bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-[#1F3864] px-2.5 py-1.5 rounded-full border border-slate-200 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input Form */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeScholarship
                    ? `Ask about ${activeScholarship.name}...`
                    : "Ask a question about scholarships..."
                }
                disabled={loading}
                className="flex-1 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2CA6A4] focus:border-transparent placeholder:text-slate-400"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || loading}
                className="bg-[#1F3864] hover:bg-[#162A4C] disabled:bg-slate-300 text-white p-2.5 rounded-xl transition-all shadow-sm"
                aria-label="Send message"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
