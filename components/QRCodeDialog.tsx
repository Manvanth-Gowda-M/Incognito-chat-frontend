"use client";

import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface QRCodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  joinUrl: string;
}

/**
 * Premium glassmorphic dialog to share the E2EE room URL via QR Code or copyable link.
 */
export default function QRCodeDialog({ isOpen, onClose, joinUrl }: QRCodeDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // console.error("Failed to copy url: ", err);
    }
  }, [joinUrl]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Dialog Body */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl glass-panel p-6 text-center text-gray-200"
          >
            {/* Close trigger */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-semibold text-white mt-1">Scan to Intercept</h3>
            <p className="text-xs text-gray-400 mt-1 mb-6 max-w-[280px] mx-auto">
              Scan this QR code on another device to join this secure channel instantly.
            </p>

            {/* QR Wrapper */}
            <div className="inline-block p-4 bg-white rounded-xl shadow-lg mb-6">
              <QRCodeSVG
                value={joinUrl}
                size={180}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#030712"
              />
            </div>

            {/* Shared link copy terminal */}
            <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-white/5 border border-white/5 text-left mb-2">
              <span className="text-xs font-mono text-gray-400 truncate flex-1 select-all">
                {joinUrl}
              </span>
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
                title="Copy secure link"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
            
            <p className="text-[10px] text-gray-500 italic mt-3">
              WARNING: Key exchange happens in the URL hash. Only share via secure pipelines.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
