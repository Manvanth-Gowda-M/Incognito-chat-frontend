"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Clock,
  Trash2,
  Shield,
  Eye,
  Check,
  CheckCheck,
  Paperclip,
  Mic,
  X,
  Play,
  Pause,
  Download,
  FileText,
  Square,
  Image as ImageIcon,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  MicOff,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function VideoFeed({ stream, isMuted, className }: { stream: MediaStream | null; isMuted?: boolean; className?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isMuted}
      className={className}
    />
  );
}

export interface Message {
  id: string;
  sender: "me" | "peer";
  senderId?: string;
  text: string;
  timestamp: number;
  read: boolean;
  selfDestructDuration?: number; // in seconds
  destructTimeRemaining?: number; // in seconds
  media?: {
    type: "image" | "audio" | "file";
    content: string; // base64 data url
    fileName?: string;
    fileSize?: number;
  };
}

interface ChatContainerProps {
  messages: Message[];
  onSendMessage: (text: string, selfDestructDuration?: number) => void;
  onSendTypingState: (isTyping: boolean) => void;
  isPeerTyping: boolean;
  connectionState: string;
  roomId: string;
  onLeaveRoom: () => void;
  onOpenShare: () => void;

  // WebRTC additions:
  callState: "idle" | "dialing" | "ringing" | "connecting" | "connected";
  callType: "audio" | "video" | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  callDuration: number;
  onInitiateCall: (type: "audio" | "video") => void;
  onAcceptCall: () => void;
  onDeclineCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  myNickname?: string;
  peerNickname?: string;
  activePeers?: Record<string, string>;
  typingPeers?: Record<string, string>;
}

const SELF_DESTRUCT_OPTIONS = [
  { label: "Timer Off", value: undefined },
  { label: "10s Destruct", value: 10 },
  { label: "1m Destruct", value: 60 },
  { label: "1h Destruct", value: 3600 },
];

/**
 * Bulletproof helper function to download a base64 Data URL.
 * Bypasses mobile browser sandboxing locks on 'data:' navigation by converting to Blobs and Object URLs.
 */
const downloadDataUrl = (dataUrl: string, fileName: string) => {
  try {
    const parts = dataUrl.split(",");
    if (parts.length < 2) return;
    const mimeMatch = parts[0].match(/data:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "";
    const base64Data = parts[1];
    
    // Decode Base64 to raw binary bytes
    const binaryStr = atob(base64Data);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    // Create a local blob object url
    const blob = new Blob([bytes], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    
    // Create temporary link and click it to trigger download
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup Object URL in background
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 200);
  } catch (err) {
    console.error("Failed to download decrypted file:", err);
  }
};

/**
 * Custom High-Fidelity Glassmorphic Voice Note Player.
 */
function VoiceNotePlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch((e) => console.log("Audio play blocked", e));
      setIsPlaying(true);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const value = parseFloat(e.target.value);
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const cycleSpeed = () => {
    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else nextRate = 1;

    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatAudioTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] w-[260px] sm:w-[280px] max-w-full shadow-inner">
      <button
        type="button"
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center transition-all shadow-md shrink-0 cursor-pointer hover:scale-105 active:scale-95"
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} className="ml-0.5" fill="currentColor" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center text-[9.5px] text-slate-400 mb-1 font-mono tracking-wider">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration || currentTime)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleScrub}
          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400 transition-all focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={cycleSpeed}
        className="px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[9px] text-slate-300 font-mono transition-colors border border-white/5 shrink-0 cursor-pointer hover:text-white"
      >
        {playbackRate}x
      </button>
    </div>
  );
}

const PUBLIC_LOBBIES = ["GAMING-ZONE", "FREE-ZONE", "TECH-ZONE", "DEV-ZONE"];

/**
 * Premium minimal glassmorphic chat container.
 */
export default function ChatContainer({
  messages,
  onSendMessage,
  onSendTypingState,
  isPeerTyping,
  connectionState,
  roomId,
  onLeaveRoom,
  onOpenShare,
  callState,
  callType,
  localStream,
  remoteStream,
  isMuted,
  isCameraOff,
  callDuration,
  onInitiateCall,
  onAcceptCall,
  onDeclineCall,
  onEndCall,
  onToggleMute,
  onToggleCamera,
  myNickname,
  peerNickname,
  activePeers = {},
  typingPeers = {}
}: ChatContainerProps) {
  const isPublicLobby = PUBLIC_LOBBIES.includes((roomId || "").toUpperCase());

  const getTypingText = () => {
    if (!typingPeers || Object.keys(typingPeers).length === 0) return null;
    const names = Object.values(typingPeers);
    if (names.length === 1) {
      return `${names[0]} is typing`;
    }
    if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing`;
    }
    return `${names[0]}, ${names[1]} and ${names.length - 2} others are typing`;
  };

  const [inputText, setInputText] = useState("");
  const [selfDestructDuration, setSelfDestructDuration] = useState<number | undefined>(undefined);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatCallDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
  };

  // Hidden attachment inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Lightbox Modal for Encrypted Images
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxFileName, setLightboxFileName] = useState<string>("");

  // Media Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPeerTyping]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Handle typing state triggers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onSendTypingState(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      onSendTypingState(false);
    }, 2000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(inputText, selfDestructDuration);
    setInputText("");
    
    // Stop typing state immediately on send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onSendTypingState(false);
  };

  // Convert seconds to human-readable count
  const formatTime = (time: number) => {
    if (time >= 3600) {
      return `${Math.ceil(time / 3600)}h`;
    }
    if (time >= 60) {
      return `${Math.ceil(time / 60)}m`;
    }
    return `${time}s`;
  };

  // Format File Size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Handle File picker processes
  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>, forceType?: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size: max 10MB
    const limit = 10 * 1024 * 1024;
    if (file.size > limit) {
      alert("File limit exceeded. Keep E2EE attachments under 10MB to maintain relay stability.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Url = event.target?.result as string;
      if (!base64Url) return;

      const mediaPayload = {
        type: forceType || (file.type.startsWith("image/") ? "image" : "file"),
        content: base64Url,
        fileName: file.name,
        fileSize: file.size,
      };

      // Send the structured media JSON payload
      onSendMessage(JSON.stringify(mediaPayload), selfDestructDuration);
    };
    reader.readAsDataURL(file);

    // Reset input value to allow selecting same file again
    e.target.value = "";
  };

  // Start Media recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Url = event.target?.result as string;
          if (!base64Url) return;

          const mediaPayload = {
            type: "audio",
            content: base64Url,
            fileName: "voice_note.webm",
            fileSize: audioBlob.size,
          };

          onSendMessage(JSON.stringify(mediaPayload), selfDestructDuration);
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 300) { 
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      alert("Microphone capture blocked or permission denied. Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = []; 
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const formatRecordingTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full max-h-[85vh] rounded-2xl glass-panel overflow-hidden border border-white/10 shadow-2xl relative">
      {/* Top Header Panel */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02] border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Dynamic Active Avatar with status pulsing halo */}
          <div className="relative shrink-0">
            <div className={`w-9 h-9 rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 border-2 flex items-center justify-center text-slate-300 shadow-md transition-all duration-500 ${
              connectionState === "ready" 
                ? "border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)] animate-[pulse_2s_infinite]" 
                : "border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.15)] animate-[pulse_2s_infinite]"
            }`}>
              <Shield size={16} className={connectionState === "ready" ? "text-emerald-400" : "text-amber-400"} />
            </div>
            {/* Small active status dot at bottom-right of avatar */}
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-[#090d16] ${
              connectionState === "ready" ? "bg-emerald-500" : "bg-amber-500"
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white tracking-wide truncate max-w-[120px] md:max-w-[200px]">
                {isPublicLobby ? roomId.toUpperCase().replace("-", " ") : (peerNickname || "Secure Partner")}
              </h2>
              {/* Connection status pill */}
              {isPublicLobby ? (
                <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-400 hidden sm:inline-flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {Object.keys(activePeers).length + 1} online
                </div>
              ) : (
                <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[9px] text-gray-400 capitalize hidden sm:inline-flex items-center gap-1 font-mono">
                  <span className={`w-1 h-1 rounded-full ${connectionState === "ready" ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {connectionState === "ready" ? "secure" : connectionState}
                </div>
              )}
            </div>
            <p className="text-[10px] text-emerald-400/80 font-medium tracking-wider mt-0.5 uppercase">Room: {roomId}</p>
          </div>
        </div>

        {/* Action button cluster */}
        <div className="flex items-center gap-2.5">
          {connectionState === "ready" && !isPublicLobby && (
            <div className="flex items-center bg-white/[0.03] border border-white/5 rounded-full p-1 shadow-inner gap-0.5">
              <button
                type="button"
                onClick={() => onInitiateCall("audio")}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center cursor-pointer"
                title="Voice Call"
              >
                <Phone size={14} />
              </button>
              <div className="w-[1px] h-3.5 bg-white/10" />
              <button
                type="button"
                onClick={() => onInitiateCall("video")}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center cursor-pointer"
                title="Video Call"
              >
                <Video size={14} />
              </button>
            </div>
          )}
          <button
            onClick={onOpenShare}
            className="px-3.5 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs text-slate-200 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all font-medium cursor-pointer shadow-sm active:scale-95"
          >
            Invite
          </button>
          <button
            onClick={onLeaveRoom}
            className="px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all font-medium cursor-pointer shadow-sm active:scale-95"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Message Feed Canvas with premium tiled wallpaper */}
      <div 
        className="flex-1 overflow-y-auto px-6 py-4 flex flex-col space-y-4 relative"
        style={{
          background: "radial-gradient(circle at top right, rgba(16, 185, 129, 0.02), transparent 400px), radial-gradient(circle at bottom left, rgba(30, 41, 59, 0.04), transparent 400px), #040813",
          backgroundImage: `radial-gradient(circle at 50% -20%, rgba(16, 185, 129, 0.03), transparent 50%), url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.012'%3E%3Cpath d='M0 0h40v40H0V0zm40 40h40v40H40V40zm0-40h2v2h-2V0zm0 4h2v2h-2V4zm0 4h2v2h-2V8zm0 12h2v2h-2v-2zm0 12h2v2h-2v-2zm0 24h2v2h-2v-2zm0 12h2v2h-2v-2zm4-68h2v2h-2v-2zm8 0h2v2h-2v-2zm12 0h2v2h-2v-2zm12 0h2v2h-2v-2zm8 0h2v2h-2v-2zm-60 8h2v2h-2V8zm0 8h2v2h-2v-2zm0 12h2v2h-2v-2zm0 16h2v2h-2v-2zm0 12h2v2h-2v-2zm0 8h2v2h-2v-2zm8 32h2v2h-2v-2zm16 0h2v2h-2v-2zm16 0h2v2h-2v-2zm16 0h2v2h-2v-2z'/%3E%3C/g%3E%3C/svg%3E")`
        }}
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
              <Eye size={20} className="opacity-50" />
            </div>
            <p className="text-sm font-medium text-white">This Room is Blank</p>
            <p className="text-xs text-slate-500 mt-1.5 max-w-[280px] leading-relaxed">
              No message logs are retained on the security relay. Plaintext disappears forever when you leave.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isMe = msg.sender === "me";
              const senderName = isMe 
                ? (myNickname || "Me") 
                : (msg.senderId && activePeers ? activePeers[msg.senderId] : (peerNickname || "Secure Partner"));
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`flex relative z-10 ${isMe ? "justify-end" : "justify-start"}`}
                >
                  {/* Tailored Premium Glassmorphic Bubbles */}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 relative text-[13.5px] leading-relaxed shadow-md transition-all ${
                      isMe
                        ? "rounded-tr-none bg-gradient-to-br from-emerald-500/10 to-teal-500/15 border border-emerald-500/20 text-slate-100 shadow-[0_4px_16px_rgba(16,185,129,0.04)]"
                        : "rounded-tl-none bg-[#0d1324]/80 border border-slate-800/40 text-slate-200 shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
                    }`}
                  >
                    {isPublicLobby && !isMe && (
                      <div className="text-[10px] font-bold text-emerald-400 mb-1 tracking-wider uppercase font-mono">
                        {senderName}
                      </div>
                    )}
                    {/* Render message depending on media properties */}
                    {msg.media ? (
                      <div className="space-y-1.5">
                        {msg.media.type === "image" && (
                          <div
                            className="relative cursor-pointer group rounded-lg overflow-hidden border border-white/5 hover:border-white/15 transition-all max-w-[240px] sm:max-w-[320px] aspect-auto shadow-md"
                            onClick={() => {
                              setLightboxImage(msg.media!.content);
                              setLightboxFileName(msg.media!.fileName || "encrypted_image.png");
                            }}
                          >
                            <img
                              src={msg.media.content}
                              alt={msg.media.fileName || "Encrypted Image"}
                              className="max-h-[200px] sm:max-h-[260px] object-cover rounded-lg"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                              <span className="text-[10px] bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 text-white font-medium">
                                <Eye size={12} /> Click to View
                              </span>
                            </div>
                          </div>
                        )}

                        {msg.media.type === "audio" && (
                          <VoiceNotePlayer src={msg.media.content} />
                        )}

                        {msg.media.type === "file" && (
                          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all w-[240px] sm:w-[280px] max-w-full gap-3 shadow-inner">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-emerald-400 shrink-0">
                                <FileText size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-white truncate">
                                  {msg.media.fileName || "encrypted_file"}
                                </p>
                                <p className="text-[9px] text-gray-500 font-mono mt-0.5">
                                  {formatFileSize(msg.media.fileSize || 0)}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => downloadDataUrl(msg.media!.content, msg.media!.fileName || "decrypted_file")}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-gray-300 hover:text-white transition-colors flex items-center justify-center shrink-0 cursor-pointer animate-none"
                              title="Download Decrypted File"
                            >
                              <Download size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Fallback Standard plaintext message */
                      <p className="break-words leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    )}
                    
                    {/* Timestamp & Meta panel */}
                    <div className="flex items-center justify-end gap-1.5 mt-2 text-[9.5px] text-slate-400/80 font-mono">
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>

                      {/* Self-destruct indicator */}
                      {msg.selfDestructDuration !== undefined && (
                        <span className="flex items-center gap-0.5 text-amber-500/80 font-medium">
                          <Clock size={8.5} />
                          {msg.destructTimeRemaining !== undefined
                            ? formatTime(msg.destructTimeRemaining)
                            : formatTime(msg.selfDestructDuration)}
                        </span>
                      )}

                      {/* Read receipts */}
                      {isMe && (
                        <span>
                          {msg.read ? (
                            <CheckCheck size={11} className="text-emerald-400" />
                          ) : (
                            <Check size={11} />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Peer Typing status banner */}
        {((isPublicLobby && Object.keys(typingPeers).length > 0) || (!isPublicLobby && isPeerTyping)) && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start relative z-10"
          >
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0d1324]/80 border border-slate-800/40">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="text-[10px] text-slate-300 pl-1 font-medium font-mono">
                {isPublicLobby ? getTypingText() : `${peerNickname || "Secure Partner"} is typing`}
              </span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Hidden input element for general document upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleAttachmentChange(e, "file")}
        className="hidden"
        accept="application/*,text/*,audio/*,video/*"
      />

      {/* Hidden input element for secure image upload */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={(e) => handleAttachmentChange(e, "image")}
        className="hidden"
        accept="image/*"
      />

      {/* Dynamic Input Panel */}
      <div className="px-6 py-4 bg-[#050914] border-t border-white/[0.04] relative">
        <AnimatePresence mode="wait">
          {isRecording ? (
            /* Voice Note Recording Console */
            <motion.div
              key="recording-console"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center justify-between w-full h-[46px] px-4 rounded-full border border-red-500/20 bg-red-500/[0.03] backdrop-blur-xl shadow-lg"
            >
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-[ping_1.5s_infinite]" />
                <span className="text-xs text-red-400 font-semibold tracking-wide uppercase text-[10px]">Recording Secure Voice Note</span>
                <span className="text-xs text-slate-400 font-mono pl-2 border-l border-white/10">
                  {formatRecordingTime(recordingDuration)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Cancel recording trigger */}
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-all cursor-pointer font-medium"
                >
                  Cancel
                </button>
                {/* Save and Send recording trigger */}
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-4 py-1.5 text-xs rounded-full bg-red-500 hover:bg-red-400 text-white font-semibold flex items-center gap-1.5 shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
                >
                  <Square size={10} fill="currentColor" /> Stop & Send
                </button>
              </div>
            </motion.div>
          ) : (
            /* Standard E2EE Text & Media Attachment panel */
            <motion.form
              key="standard-console"
              onSubmit={handleSend}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-3 w-full"
            >
              {/* Unified Input Capsule */}
              <div className="flex-1 flex items-center bg-[#090d16]/75 border border-white/[0.08] rounded-full px-3.5 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all focus-within:border-white/20 gap-2">
                
                {/* Attachment tools group */}
                <div className="flex items-center gap-1">
                  {/* Secure Image upload button */}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={connectionState !== "ready"}
                    className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center cursor-pointer shrink-0"
                    title="Send secure photo"
                  >
                    <ImageIcon size={16} />
                  </button>

                  {/* Secure File attachment button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={connectionState !== "ready"}
                    className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center cursor-pointer shrink-0"
                    title="Attach secure document"
                  >
                    <Paperclip size={16} />
                  </button>
                </div>

                {/* Vertical Divider */}
                <div className="w-[1px] h-5 bg-white/10 shrink-0" />

                {/* Secure Message input */}
                <div className="flex-1 relative flex items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    placeholder={
                      connectionState === "ready"
                        ? "Enter secure message..."
                        : "Syncing with peer..."
                    }
                    disabled={connectionState !== "ready"}
                    className="w-full bg-transparent border-0 outline-none ring-0 focus:ring-0 text-sm text-slate-200 placeholder-slate-500 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  {selfDestructDuration !== undefined && (
                    <div className="absolute right-1 text-amber-500/80 pointer-events-none" title="Destruction active">
                      <Trash2 size={12} className="animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Timer Selector button */}
                <div className="relative shrink-0 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowTimerMenu(!showTimerMenu)}
                    className={`p-2 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                      selfDestructDuration !== undefined
                        ? "bg-amber-500/10 text-amber-400"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                    title="Set self-destruct duration"
                  >
                    <Clock size={16} />
                    {selfDestructDuration !== undefined && (
                      <span className="absolute -top-0.5 -right-0.5 text-[8px] px-1 rounded-full bg-amber-500 text-black font-extrabold">
                        {formatTime(selfDestructDuration)}
                      </span>
                    )}
                  </button>

                  {/* Timer select dropdown */}
                  <AnimatePresence>
                    {showTimerMenu && (
                      <>
                        <div className="fixed inset-0 z-35" onClick={() => setShowTimerMenu(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-11 right-0 z-40 w-36 rounded-2xl border border-white/10 bg-[#090D16]/95 backdrop-blur-xl p-1.5 shadow-xl"
                        >
                          {SELF_DESTRUCT_OPTIONS.map((opt) => (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => {
                                setSelfDestructDuration(opt.value);
                                setShowTimerMenu(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                selfDestructDuration === opt.value
                                  ? "bg-white/5 text-white font-medium"
                                  : "text-slate-400 hover:bg-white/[0.02] hover:text-white"
                              }`}
                            >
                              {opt.label}
                              {selfDestructDuration === opt.value && <div className="w-1 h-1 rounded-full bg-emerald-400" />}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

              </div>

              {/* Floating Contextual Button (Mic or Send) */}
              <div className="shrink-0">
                <AnimatePresence mode="wait">
                  {!inputText.trim() ? (
                    /* Voice recording activation button */
                    <motion.button
                      key="mic-btn"
                      type="button"
                      onClick={startRecording}
                      disabled={connectionState !== "ready"}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="w-11 h-11 rounded-full bg-[#182235]/90 border border-white/5 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer hover:bg-[#202d46]"
                      title="Record voice note"
                    >
                      <Mic size={16} />
                    </motion.button>
                  ) : (
                    /* Transmit button */
                    <motion.button
                      key="send-btn"
                      type="submit"
                      disabled={connectionState !== "ready"}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="w-11 h-11 rounded-full bg-emerald-500 text-black flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(16,185,129,0.35)] cursor-pointer hover:bg-emerald-400"
                      title="Send message"
                    >
                      <Send size={16} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Ringing Overlay / incoming call popover */}
      <AnimatePresence>
        {callState === "ringing" && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4"
          >
            <div className="rounded-2xl border border-emerald-500/20 bg-[#090D16]/95 backdrop-blur-xl p-4 shadow-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 animate-pulse shrink-0">
                  {callType === "video" ? <Video size={18} /> : <Phone size={18} />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">
                    Incoming Call from {peerNickname || "Secure Partner"}...
                  </p>
                  <p className="text-[10px] text-gray-400 capitalize">
                    Secure E2EE {callType} Call
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onDeclineCall}
                  className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/20 transition-all font-medium cursor-pointer"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={onAcceptCall}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-all font-semibold text-xs cursor-pointer"
                >
                  Accept
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Screen Overlay */}
      <AnimatePresence>
        {(callState === "dialing" || callState === "connecting" || callState === "connected") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-40 bg-[#030712]/95 backdrop-blur-2xl flex flex-col justify-between p-6 overflow-hidden rounded-2xl border border-white/5"
          >
            {/* Call Header Panel */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-pulse">
                  <Shield size={14} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">
                    {callState === "connected" ? "E2EE Call Established" : "Securing Connection..."}
                  </p>
                  <p className="text-[9px] text-gray-500 font-mono">P2P Peer Direct</p>
                </div>
              </div>

              {/* Call Status Badge */}
              <div className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] text-gray-400 font-mono">
                {callState === "connected" ? formatCallDuration(callDuration) : callState}
              </div>
            </div>

            {/* Call Screen Center Viewport */}
            <div className="flex-1 flex items-center justify-center relative w-full h-full my-4">
              {callType === "video" ? (
                <div className="w-full h-full rounded-2xl overflow-hidden bg-black/40 border border-white/5 relative flex items-center justify-center">
                  {/* Remote Video (Full Screen inside viewport) */}
                  {remoteStream ? (
                    <VideoFeed stream={remoteStream} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <Loader2 className="animate-spin text-gray-400 mb-2" size={24} />
                      <p className="text-xs text-gray-400">
                        Waiting for stream from {peerNickname || "partner"}...
                      </p>
                    </div>
                  )}

                  {/* Local Video Picture-in-Picture */}
                  {localStream && (
                    <div className="absolute bottom-4 right-4 w-28 sm:w-36 aspect-[3/4] rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-black/60 z-10">
                      <VideoFeed stream={localStream} isMuted className="w-full h-full object-cover" />
                      {isCameraOff && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-gray-500 text-[10px] font-medium">
                          Camera Off
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Voice Call Visualizer */
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="relative flex items-center justify-center mb-6">
                    {/* Breathing circles */}
                    <motion.div
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="absolute w-24 h-24 rounded-full bg-emerald-500/5 border border-emerald-500/10"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.25, 1] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 0.5 }}
                      className="absolute w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                    />
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 relative z-10 shadow-lg">
                      <Mic size={24} />
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-white font-medium">
                    Secure Voice Channel with {peerNickname || "Secure Partner"}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 capitalize">
                    {callState === "connected" ? "Connected" : callState === "dialing" ? "Calling..." : "Connecting..."}
                  </p>
                </div>
              )}
            </div>

            {/* Call Controls Panel */}
            <div className="flex items-center justify-center gap-4 w-full">
              {/* Mic toggle */}
              <button
                type="button"
                onClick={onToggleMute}
                className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-md ${
                  isMuted
                    ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                    : "bg-white/5 border-white/5 text-gray-300 hover:text-white hover:bg-white/10"
                }`}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              {/* Camera toggle (Only shown for video calls) */}
              {callType === "video" && (
                <button
                  type="button"
                  onClick={onToggleCamera}
                  className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-md ${
                    isCameraOff
                      ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                      : "bg-white/5 border-white/5 text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                  title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
                >
                  {isCameraOff ? <VideoOff size={16} /> : <Video size={16} />}
                </button>
              )}

              {/* Hangup button */}
              <button
                type="button"
                onClick={onEndCall}
                className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-105 animate-none"
                title="End Call"
              >
                <PhoneOff size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Immersive Image Lightbox Overlay Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-full max-h-[85vh] rounded-2xl overflow-hidden glass-panel border border-white/10 flex flex-col items-center shadow-2xl"
            >
              {/* Lightbox Header Panel */}
              <div className="w-full flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                <span className="text-xs text-gray-300 font-mono truncate max-w-[200px] md:max-w-md">
                  {lightboxFileName}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => downloadDataUrl(lightboxImage, lightboxFileName)}
                    className="p-2 rounded-xl bg-white/5 border border-white/5 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/10 transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                    title="Download Decrypted Image"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => setLightboxImage(null)}
                    className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all flex items-center justify-center cursor-pointer"
                    title="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Lightbox Image Viewport */}
              <div className="p-6 flex items-center justify-center max-w-full max-h-[70vh] overflow-auto select-none">
                <img
                  src={lightboxImage}
                  alt="Decrypted fullscreen view"
                  className="object-contain max-w-full max-h-[60vh] rounded-lg border border-white/5 shadow-2xl"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
