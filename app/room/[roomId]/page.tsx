"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCrypto } from "@/hooks/useCrypto";
import { useSocket } from "@/hooks/useSocket";
import ChatContainer, { Message } from "@/components/ChatContainer";
import QRCodeDialog from "@/components/QRCodeDialog";
import { Shield, Key, Copy, Check, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params?.roomId as string;
  const { importKeyFromBase64, decryptMessage, encryptMessage, deriveKeyFromString } = useCrypto();

  // Local Cryptographic state
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [manualKeyInput, setManualKeyInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

  // Identity alias states
  const [nickname, setNickname] = useState<string | null>(null);
  const [hasSetNickname, setHasSetNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");

  // Pre-generate alias on mount
  useEffect(() => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const prefixes = ["Agent", "Ghost", "Phantom", "Cipher", "Sentry", "Spectre", "Shadow", "Guardian", "Viper", "Oracle"];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    setNicknameInput(`${randomPrefix}-${randomSuffix}`);
  }, []);

  // Check for pre-selected nickname on mount to bypass second input screen
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("cloakchat_nickname");
      if (stored) {
        setNickname(stored);
        setHasSetNickname(true);
      }
    }
  }, []);

  // Invitation dialog state
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [absoluteJoinUrl, setAbsoluteJoinUrl] = useState("");

  // Ephemeral message database in React state
  const [messages, setMessages] = useState<Message[]>([]);

  // WebRTC Signaling Wrapper to break circular hook dependency
  const onWebRTCSignalRef = useRef<(payload: { senderId: string; signal: any }) => void>(() => {});
  const onWebRTCSignal = useCallback((payload: { senderId: string; signal: any }) => {
    console.log("[PAGE] onWebRTCSignal callback triggered with payload:", payload);
    onWebRTCSignalRef.current(payload);
  }, []);

  // Callbacks for inline join/leave system message notifications
  const handlePeerJoined = useCallback((peerId: string, peerName: string) => {
    const systemMsg: Message = {
      id: `system-join-${peerId}-${Date.now()}`,
      sender: "system",
      text: `${peerName} joined the chat`,
      timestamp: Date.now(),
      read: true,
    };
    setMessages((prev) => {
      // Avoid duplicate join messages if they fast-reconnect
      const exists = prev.some(m => m.sender === "system" && m.text === systemMsg.text && Date.now() - m.timestamp < 3000);
      if (exists) return prev;
      return [...prev, systemMsg];
    });
  }, []);

  const handlePeerLeft = useCallback((peerId: string, peerName: string) => {
    const systemMsg: Message = {
      id: `system-leave-${peerId}-${Date.now()}`,
      sender: "system",
      text: `${peerName} left the chat`,
      timestamp: Date.now(),
      read: true,
    };
    setMessages((prev) => {
      // Avoid duplicate leave messages if they fast-reconnect
      const exists = prev.some(m => m.sender === "system" && m.text === systemMsg.text && Date.now() - m.timestamp < 3000);
      if (exists) return prev;
      return [...prev, systemMsg];
    });
  }, []);

  const {
    connectionState,
    isPeerTyping,
    peerId,
    peerNickname,
    activePeers,
    typingPeers,
    inboundMessage,
    inboundReaction,
    readReceiptMsgId,
    errorMessage,
    sendEncryptedMessage,
    sendTypingState,
    sendReadReceipt,
    sendWebRTCSignal,
    sendReaction,
    leaveRoom
  } = useSocket(roomId, nickname, onWebRTCSignal, handlePeerJoined, handlePeerLeft);

  // WebRTC Call State
  const [callState, setCallState] = useState<"idle" | "dialing" | "ringing" | "connecting" | "connected">("idle");
  const [callType, setCallType] = useState<"audio" | "video" | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);

  // Clean/reset all media resources on tear down
  const resetCallState = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    remoteCandidatesQueueRef.current = [];

    setCallState("idle");
    setCallType(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallDuration(0);
  }, []);

  // WebRTC Peer Connection builder
  const setupWebRTCPeer = useCallback(async (isInitiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    });
    peerConnectionRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendWebRTCSignal({
          type: "candidate",
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setCallState("connected");
      }
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        resetCallState();
      }
    };

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWebRTCSignal({
          type: "offer",
          sdp: offer
        });
      } catch (err) {
        resetCallState();
      }
    }
  }, [sendWebRTCSignal, resetCallState]);

  // Handle incoming signaling packets
  const handleWebRTCSignal = useCallback(async (signal: any) => {
    if (!signal || !signal.type) return;
    console.log("[PAGE] handleWebRTCSignal processing packet type:", signal.type, "payload:", signal, "current callState:", callState);

    switch (signal.type) {
      case "call-request":
        if (callState !== "idle") {
          sendWebRTCSignal({ type: "call-declined", reason: "busy" });
          return;
        }
        setCallType(signal.callType);
        setCallState("ringing");
        break;

      case "call-declined":
        resetCallState();
        break;

      case "call-accepted":
        if (callState === "dialing") {
          setCallState("connecting");
          await setupWebRTCPeer(true);
        }
        break;

      case "offer":
        if (callState === "ringing" || callState === "connecting" || callState === "idle") {
          setCallState("connecting");
          if (!localStreamRef.current) {
            try {
              const currentCallType = callType || signal.callType || "audio";
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: currentCallType === "video" ? { facingMode: "user" } : false
              });
              localStreamRef.current = stream;
              setLocalStream(stream);
            } catch (e) {
              sendWebRTCSignal({ type: "call-declined", reason: "permission-denied" });
              resetCallState();
              return;
            }
          }
          await setupWebRTCPeer(false);
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            
            // Process queued candidates
            remoteCandidatesQueueRef.current.forEach((candidate) => {
              peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            });
            remoteCandidatesQueueRef.current = [];

            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            sendWebRTCSignal({
              type: "answer",
              sdp: answer
            });
          }
        }
        break;

      case "answer":
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          
          // Process queued candidates
          remoteCandidatesQueueRef.current.forEach((candidate) => {
            peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          });
          remoteCandidatesQueueRef.current = [];
        }
        break;

      case "candidate":
        if (signal.candidate) {
          if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (e) {
              // ignore candidate error
            }
          } else {
            remoteCandidatesQueueRef.current.push(signal.candidate);
          }
        }
        break;

      case "hangup":
        resetCallState();
        break;

      default:
        break;
    }
  }, [callState, callType, sendWebRTCSignal, setupWebRTCPeer, resetCallState]);

  // Connect wrapper ref to latest handleWebRTCSignal logic
  useEffect(() => {
    onWebRTCSignalRef.current = (payload: { senderId: string; signal: any }) => {
      handleWebRTCSignal(payload.signal);
    };
  }, [handleWebRTCSignal]);

  // Outgoing call triggers
  const initiateCall = useCallback(async (type: "audio" | "video") => {
    setCallType(type);
    setCallState("dialing");

    try {
      const constraints = {
        audio: true,
        video: type === "video" ? { facingMode: "user" } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      sendWebRTCSignal({
        type: "call-request",
        callType: type
      });
    } catch (err) {
      alert("Could not access microphone or camera. Please verify permission settings.");
      resetCallState();
    }
  }, [sendWebRTCSignal, resetCallState]);

  const acceptCall = useCallback(async () => {
    if (callState !== "ringing") return;
    setCallState("connecting");

    try {
      const constraints = {
        audio: true,
        video: callType === "video" ? { facingMode: "user" } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      sendWebRTCSignal({
        type: "call-accepted"
      });
    } catch (err) {
      alert("Could not access microphone or camera. Call aborted.");
      sendWebRTCSignal({ type: "call-declined", reason: "permission-denied" });
      resetCallState();
    }
  }, [callState, callType, sendWebRTCSignal, resetCallState]);

  const declineCall = useCallback(() => {
    sendWebRTCSignal({
      type: "call-declined"
    });
    resetCallState();
  }, [sendWebRTCSignal, resetCallState]);

  const endCall = useCallback(() => {
    sendWebRTCSignal({
      type: "hangup"
    });
    resetCallState();
  }, [sendWebRTCSignal, resetCallState]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current && callType === "video") {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  }, [callType]);

  // WebRTC signaling is now routed synchronously through a callback ref to prevent state loop race conditions.

  // Effect: Call Duration Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (callState === "connected") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  // Effect: Auto-reset call if user connection drops
  useEffect(() => {
    if (connectionState !== "ready") {
      resetCallState();
    }
  }, [connectionState, resetCallState]);

  // Set the absolute invite URL once mounted on the client
  useEffect(() => {
    if (typeof window !== "undefined" && roomId) {
      setAbsoluteJoinUrl(window.location.href);
    }
  }, [roomId, cryptoKey]);

  // 1. Core Hook: Extract E2EE key from URL Hash or derive it deterministically for public lobbies
  useEffect(() => {
    const loadKeyFromHash = async () => {
      try {
        if (typeof window === "undefined") return;

        const publicLobbies = ["GAMING-ZONE", "FREE-ZONE", "TECH-ZONE", "DEV-ZONE"];
        const uppercaseRoomId = (roomId || "").toUpperCase();
        const isPublicLobby = publicLobbies.includes(uppercaseRoomId);

        if (isPublicLobby) {
          const derivedKey = await deriveKeyFromString(uppercaseRoomId);
          setCryptoKey(derivedKey);
          setKeyError(null);
          return;
        }

        if (!window.location.hash) {
          // No key hash present; user will have to enter manually
          return;
        }

        const hashKey = window.location.hash.slice(1); // Strip the "#"
        if (hashKey) {
          const importedKey = await importKeyFromBase64(hashKey);
          setCryptoKey(importedKey);
          setKeyError(null);
        }
      } catch (err) {
        setKeyError("Failed to parse encryption key from URL fragment. Please verify the link.");
      }
    };

    loadKeyFromHash();
  }, [roomId, importKeyFromBase64, deriveKeyFromString]);

  // 2. Core Hook: Listen for inbound encrypted payloads and decrypt them in client-side state
  useEffect(() => {
    if (!inboundMessage || !cryptoKey) return;

    const decryptInbound = async () => {
      try {
        const decryptedText = await decryptMessage(
          inboundMessage.ciphertext,
          inboundMessage.iv,
          cryptoKey
        );

        let mediaData: Message["media"] | undefined = undefined;
        let displayText = decryptedText;

        if (decryptedText.startsWith("{") && decryptedText.endsWith("}")) {
          try {
            const parsed = JSON.parse(decryptedText);
            if (parsed && (parsed.type === "image" || parsed.type === "audio" || parsed.type === "file")) {
              mediaData = {
                type: parsed.type,
                content: parsed.content,
                fileName: parsed.fileName,
                fileSize: parsed.fileSize,
              };
              displayText = parsed.content;
            }
          } catch (e) {
            // Ignore parse failure, treat as standard text
          }
        }

        const newMsg: Message = {
          id: Math.random().toString(),
          sender: "peer",
          senderId: inboundMessage.senderId,
          text: displayText,
          timestamp: inboundMessage.timestamp,
          read: true,
          selfDestructDuration: inboundMessage.selfDestructDuration,
          destructTimeRemaining: inboundMessage.selfDestructDuration,
          media: mediaData,
        };

        setMessages((prev) => {
          // Prevent duplicate message rendering
          const exists = prev.some(
            (m) => m.text === newMsg.text && Math.abs(m.timestamp - newMsg.timestamp) < 1000
          );
          if (exists) return prev;
          return [...prev, newMsg];
        });

        // Trigger read receipt broadcast
        if (newMsg.id) {
          sendReadReceipt(newMsg.id);
        }
      } catch (err) {
        // console.error("Decryption failure. The room keys might not match.", err);
      }
    };

    decryptInbound();
  }, [inboundMessage, cryptoKey, decryptMessage, sendReadReceipt]);

  // 3. Core Hook: Trigger celebratory confetti once clients are paired securely
  useEffect(() => {
    if (connectionState === "ready") {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ["#10b981", "#ffffff", "#3b82f6"],
        disableForReducedMotion: true,
      });
    }
  }, [connectionState]);

  // 4. Core Hook: Manage E2EE read receipts
  useEffect(() => {
    if (!readReceiptMsgId) return;
    setMessages((prev) =>
      prev.map((msg) => (msg.sender === "me" ? { ...msg, read: true } : msg))
    );
  }, [readReceiptMsgId]);

  // 5. Core Hook: Handle self-destruct timers locally inside browser memory
  useEffect(() => {
    const activeDestructMessages = messages.some(
      (m) => m.selfDestructDuration !== undefined && (m.destructTimeRemaining ?? 0) > 0
    );

    if (!activeDestructMessages) return;

    const timer = setInterval(() => {
      setMessages((prev) => {
        return prev
          .map((msg) => {
            if (msg.selfDestructDuration !== undefined) {
              const remaining = msg.destructTimeRemaining !== undefined
                ? msg.destructTimeRemaining - 1
                : msg.selfDestructDuration - 1;
              return { ...msg, destructTimeRemaining: remaining };
            }
            return msg;
          })
          .filter((msg) => msg.selfDestructDuration === undefined || (msg.destructTimeRemaining ?? 0) > 0);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [messages]);

  /**
   * Action handler: Manual E2EE Key Entry
   */
  const handleManualKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualKeyInput.trim()) return;

    try {
      const cleanKey = manualKeyInput.trim();
      const importedKey = await importKeyFromBase64(cleanKey);
      setCryptoKey(importedKey);
      setKeyError(null);

      // Save key into url hash for convenient copy-paste invites
      window.location.hash = cleanKey;
    } catch (err) {
      setKeyError("Invalid Base64URL key structure. Please verify.");
    }
  };

  /**
   * Action handler: Encrypt and Transmit message
   */
  const handleSendMessage = async (text: string, duration?: number) => {
    if (!cryptoKey) return;

    try {
      // 1. Encrypt locally inside the client browser sandbox
      const { ciphertext, iv } = await encryptMessage(text, cryptoKey);

      // 2. Fling ciphertext + IV over Socket.IO channel
      sendEncryptedMessage(ciphertext, iv, duration);

      let mediaData: Message["media"] | undefined = undefined;
      let displayText = text;

      if (text.startsWith("{") && text.endsWith("}")) {
        try {
          const parsed = JSON.parse(text);
          if (parsed && (parsed.type === "image" || parsed.type === "audio" || parsed.type === "file")) {
            mediaData = {
              type: parsed.type,
              content: parsed.content,
              fileName: parsed.fileName,
              fileSize: parsed.fileSize,
            };
            displayText = parsed.content;
          }
        } catch (e) {
          // Ignore parse failure, treat as standard text
        }
      }

      // 3. Keep plaintext exclusively in Client A's state
      const localMsg: Message = {
        id: Math.random().toString(),
        sender: "me",
        text: displayText,
        timestamp: Date.now(),
        read: false,
        selfDestructDuration: duration,
        destructTimeRemaining: duration,
        media: mediaData,
      };

      setMessages((prev) => [...prev, localMsg]);
    } catch (err) {
      // console.error("Encryption failed before transmission.", err);
    }
  };

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(absoluteJoinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      // console.error("Copy failed: ", err);
    }
  }, [absoluteJoinUrl]);

  const handleLeave = () => {
    leaveRoom();
    router.push("/");
  };

  // State A: Encryption keys not imported or mismatched
  if (!cryptoKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712] p-6 relative">
        {/* Gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.01),transparent)] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl glass-panel p-6 border border-white/5 shadow-2xl text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white mx-auto mb-4">
            <Key size={20} />
          </div>

          <h2 className="text-lg font-bold text-white mb-2">Cryptographic Verification Needed</h2>
          <p className="text-xs text-gray-400 mb-6 leading-relaxed">
            The relay channel requires the 256-bit symmetric key to perform local decryption. Enter the base64 room key manually below.
          </p>

          <form onSubmit={handleManualKeySubmit} className="space-y-4">
            <input
              type="text"
              value={manualKeyInput}
              onChange={(e) => setManualKeyInput(e.target.value)}
              placeholder="e.g. kH9D_LM92_29FJd..."
              className="w-full glass-input px-3.5 py-2.5 text-xs text-center font-mono placeholder-gray-600 focus:placeholder-transparent"
            />
            <button
              type="submit"
              disabled={!manualKeyInput.trim()}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-gray-200 text-black font-semibold text-xs transition-all disabled:opacity-30"
            >
              Verify Security Key
            </button>
          </form>

          {keyError && (
            <div className="mt-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-medium">
              {keyError}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // State A.5: Choose alias before entering chat
  if (!hasSetNickname) {
    const handleSetAliasSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = nicknameInput.trim();
      if (!trimmed) return;
      setNickname(trimmed);
      setHasSetNickname(true);
    };

    const handleRandomizeAlias = () => {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const prefixes = ["Agent", "Ghost", "Phantom", "Cipher", "Sentry", "Spectre", "Shadow", "Guardian", "Viper", "Oracle"];
      const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      setNicknameInput(`${randomPrefix}-${randomSuffix}`);
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712] p-6 relative select-none">
        {/* Ambient background glows */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.01),transparent)] pointer-events-none" />
        <div className="absolute top-[30%] left-[30%] w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-[80px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl glass-panel p-6 border border-white/5 shadow-2xl text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white mx-auto mb-4 relative">
            <Shield size={20} className="text-emerald-400" />
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 rounded-xl bg-emerald-500/5 border border-emerald-500/10 pointer-events-none"
            />
          </div>

          <h2 className="text-lg font-bold text-white mb-2">Establish Your Alias</h2>
          <p className="text-xs text-gray-400 mb-6 leading-relaxed">
            CloakChat rooms are end-to-end encrypted and retain no record of user identity. Choose a temporary alias for this session.
          </p>

          <form onSubmit={handleSetAliasSubmit} className="space-y-4">
            <div className="relative flex items-center">
              <input
                type="text"
                maxLength={25}
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="Enter nickname..."
                className="w-full glass-input px-4 py-3 text-sm text-center font-medium text-slate-100 placeholder-gray-600 focus:placeholder-transparent focus:border-emerald-500/30 transition-all duration-300"
              />
              <button
                type="button"
                onClick={handleRandomizeAlias}
                className="absolute right-3.5 p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-white/5 transition-colors cursor-pointer"
                title="Roll new alias"
              >
                <Sparkles size={14} />
              </button>
            </div>
            
            <button
              type="submit"
              disabled={!nicknameInput.trim()}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-gray-200 text-black font-semibold text-xs transition-all shadow-[0_4px_20px_rgba(255,255,255,0.06)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              Enter Secure Vault
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // State B: Socket connection issues / limit full error
  if (connectionState === "full") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712] p-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl glass-panel p-6 border border-white/5 shadow-2xl"
        >
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto mb-4">
            <Shield size={20} />
          </div>
          <h2 className="text-lg font-semibold text-white">Channel Blocked</h2>
          <p className="text-xs text-gray-400 mt-2 mb-6 leading-relaxed">
            The requested chat room has reached its maximum size of 2 clients. Direct connection has been rejected to prevent unauthorized interceptors.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-xs transition-all"
          >
            Return to Base
          </button>
        </motion.div>
      </div>
    );
  }

  if (connectionState === "error" || errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712] p-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl glass-panel p-6 border border-white/5 shadow-2xl"
        >
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto mb-4">
            <Shield size={20} />
          </div>
          <h2 className="text-lg font-semibold text-white">Relay Disconnection</h2>
          <p className="text-xs text-gray-400 mt-2 mb-6 leading-relaxed">
            {errorMessage || "An unexpected error occurred during socket connection handshake."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-2.5 rounded-xl bg-white hover:bg-gray-200 text-black font-semibold text-xs transition-all"
          >
            Back to Base
          </button>
        </motion.div>
      </div>
    );
  }

  // State C: Handshake connecting state
  if (connectionState === "connecting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#030712] p-6 text-center gap-4">
        <Loader2 size={32} className="text-gray-400 animate-spin" />
        <div>
          <p className="text-sm font-semibold text-white">Opening Tunnel</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Contacting secure message relay...</p>
        </div>
      </div>
    );
  }

  // State D: Connected but waiting for peer to join
  if (connectionState === "waiting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712] p-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.01),transparent)] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl glass-panel p-6 border border-white/5 shadow-2xl text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-gray-400 mx-auto mb-4 animate-pulse">
            <Loader2 className="animate-spin" size={20} />
          </div>

          <h2 className="text-base font-semibold text-white mb-1">Awaiting Peer Node</h2>
          <p className="text-xs text-gray-400 mb-6 max-w-[280px] mx-auto">
            Provide this invitation link to the other participant. Plaintext tunnel opens automatically when they join.
          </p>

          {/* Invitation Copy Code Bar */}
          <div className="flex items-center gap-2 p-1.5 pl-3.5 rounded-xl bg-white/[0.03] border border-white/5 text-left mb-4">
            <span className="text-xs font-mono text-gray-300 truncate flex-1 select-all">
              {absoluteJoinUrl}
            </span>
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
              title="Copy link"
            >
              {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-6">
            <button
              onClick={() => setIsShareOpen(true)}
              className="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/5 transition-all"
            >
              Show QR Code
            </button>
            <button
              onClick={handleLeave}
              className="py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/10 transition-all"
            >
              Abort Channel
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/[0.02] border border-emerald-500/10 text-[10px] text-emerald-400/80 leading-relaxed flex gap-2.5 text-left">
            <Shield size={16} className="shrink-0 mt-0.5" />
            <p>
              **Absolute E2EE**: The hash fragment is kept in your browser sandbox. The server only routes scrambled ciphertext.
            </p>
          </div>
        </motion.div>

        {/* QR Code dialog popover */}
        <QRCodeDialog
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          joinUrl={absoluteJoinUrl}
        />
      </div>
    );
  }

  // State E: Fully connected, exactly 2 clients synced and talking
  return (
    <div className="min-h-screen flex flex-col justify-center max-w-4xl w-full mx-auto p-4 md:p-6 bg-[#030712]">
      <ChatContainer
        messages={messages}
        onSendMessage={handleSendMessage}
        onSendTypingState={sendTypingState}
        isPeerTyping={isPeerTyping}
        connectionState={connectionState}
        roomId={roomId}
        onLeaveRoom={handleLeave}
        onOpenShare={() => setIsShareOpen(true)}
        callState={callState}
        callType={callType}
        localStream={localStream}
        remoteStream={remoteStream}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        callDuration={callDuration}
        onInitiateCall={initiateCall}
        onAcceptCall={acceptCall}
        onDeclineCall={declineCall}
        onEndCall={endCall}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        myNickname={nickname || "Me"}
        peerNickname={peerNickname || undefined}
        activePeers={activePeers}
        typingPeers={typingPeers}
        inboundReaction={inboundReaction}
        onSendReaction={sendReaction}
        cryptoKey={cryptoKey}
        encryptMessage={encryptMessage}
        decryptMessage={decryptMessage}
      />

      {/* QR Code modal popover */}
      <QRCodeDialog
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        joinUrl={absoluteJoinUrl}
      />
    </div>
  );
}
