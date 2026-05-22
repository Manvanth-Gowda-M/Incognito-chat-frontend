"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Key,
  ArrowRight,
  Server,
  Lock,
  Unlock,
  Sparkles,
  MessageSquare,
  Gamepad2,
  Cpu,
  Code,
  User,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCrypto } from "@/hooks/useCrypto";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function LandingPage() {
  const router = useRouter();
  const { generateEncryptionKey, exportKeyToBase64 } = useCrypto();

  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [customRoomName, setCustomRoomName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);

  // Identity / Modal states
  const [nickname, setNickname] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"create" | "join" | "public">("create");
  const [targetPublicRoom, setTargetPublicRoom] = useState("");

  // Prefill nickname on mount
  const handleRandomizeNickname = useCallback(() => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const prefixes = ["Agent", "Ghost", "Phantom", "Cipher", "Sentry", "Spectre", "Shadow", "Guardian", "Viper", "Oracle"];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    setNickname(`${randomPrefix}-${randomSuffix}`);
  }, []);

  useEffect(() => {
    handleRandomizeNickname();
  }, [handleRandomizeNickname]);

  // E2EE visualizer state values
  const [visualStep, setVisualStep] = useState(0);

  // Cycle the E2EE visualizer steps for landing page wow-factor
  useEffect(() => {
    const timer = setInterval(() => {
      setVisualStep((prev) => (prev + 1) % 4);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  // Modal open triggers
  const triggerCreateModal = () => {
    setModalType("create");
    setIsModalOpen(true);
  };

  const triggerJoinModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomCode.trim()) return;
    setModalType("join");
    setIsModalOpen(true);
  };

  const triggerPublicModal = (roomName: string) => {
    setTargetPublicRoom(roomName);
    setModalType("public");
    setIsModalOpen(true);
  };

  /**
   * Action handler: API Room Creation & Cryptographic Key Generation
   */
  const handleCreateRoom = async () => {
    try {
      setCreatingRoom(true);
      setJoinError(null);
      setIsModalOpen(false);

      // Save custom nickname to browser storage
      sessionStorage.setItem("cloakchat_nickname", nickname.trim() || "Anonymous");

      // 1. Fetch ephemeral room code from backend passing customRoomName if available
      const res = await fetch(`${BACKEND_URL}/api/room/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName: customRoomName })
      });

      if (!res.ok) {
        throw new Error("Relay server returned an error during creation.");
      }

      const { roomId } = await res.json();

      // 2. Generate E2EE Symmetric Key on client browser
      const keyObj = await generateEncryptionKey();
      const base64Key = await exportKeyToBase64(keyObj);

      // 3. Navigate client. Key goes strictly into the URL Hash!
      router.push(`/room/${roomId}#${base64Key}`);
    } catch (err) {
      setJoinError("Could not reach message relay. Please verify your connection.");
      setCreatingRoom(false);
    }
  };

  /**
   * Action handler: Decode invitation links or manually join rooms
   */
  const handleJoinRoom = () => {
    if (!joinRoomCode.trim()) return;

    setJoiningRoom(true);
    setJoinError(null);
    setIsModalOpen(false);

    try {
      // Save custom nickname to browser storage
      sessionStorage.setItem("cloakchat_nickname", nickname.trim() || "Anonymous");

      let code = joinRoomCode.trim();
      let hash = "";

      // Extract Room ID and Key if user pastes the entire invite link
      if (code.includes("/room/")) {
        const urlObj = new URL(code);
        const pathParts = urlObj.pathname.split("/");
        code = pathParts[pathParts.length - 1]; // Code is last path segment
        hash = urlObj.hash; // Key is in hash
      }

      if (!code) {
        throw new Error("Unable to parse room identifier from input.");
      }

      // Navigate to room (preserve parsed hash key if present)
      router.push(`/room/${code}${hash}`);
    } catch (err) {
      setJoinError("Invalid link or room code. Please check your invitation.");
      setJoiningRoom(false);
    }
  };

  /**
   * Action handler: Connect to a public lobby
   */
  const handleJoinPublicLobby = () => {
    if (!targetPublicRoom) return;

    setIsModalOpen(false);
    
    // Save custom nickname to browser storage
    sessionStorage.setItem("cloakchat_nickname", nickname.trim() || "Anonymous");

    // Navigate to room
    router.push(`/room/${targetPublicRoom.toUpperCase()}`);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-[#030712] px-6 py-12 md:px-12 select-none">
      {/* Premium Ambient Background Blur Nodes */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            x: [0, 80, -40, 0],
            y: [0, -60, 40, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-slate-800/10 blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -90, 70, 0],
            y: [0, 50, -80, 0],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-[10%] -right-[10%] w-[55vw] h-[55vw] rounded-full bg-slate-900/20 blur-[150px]"
        />
      </div>

      {/* Header Branding */}
      <div className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.03] border border-white/10 text-white shadow-lg backdrop-blur-md">
            <Shield size={16} />
          </div>
          <span className="text-sm font-bold tracking-wider text-white">CLOAKCHAT</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold tracking-wide uppercase">Secured</span>
        </div>
      </div>

      {/* Hero & Intercept Controls */}
      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center my-auto">
        
        {/* Left Column: Hero Tagline & Interactive E2EE Visualizer */}
        <div className="lg:col-span-7 flex flex-col space-y-8 text-left">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
              Private conversations.<br />
              <span className="text-gray-400">Zero identity.</span>
            </h1>
            <p className="text-sm md:text-base text-gray-400 max-w-[480px] leading-relaxed">
              An anonymous real-time encrypted messaging channel. No user signups, no analytics tracking, no server-side databases, and zero footprint.
            </p>
          </div>

          {/* Interactive E2EE Live Simulation Widget */}
          <div className="rounded-2xl glass-card p-6 border border-white/5 max-w-[480px]">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Cryptographic Relay Pipeline
            </h3>
            
            <div className="flex items-center justify-between relative py-6">
              {/* Device A (Sender) */}
              <div className="flex flex-col items-center z-10">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                  visualStep === 0
                    ? "bg-white text-black border-white"
                    : "bg-white/[0.02] border-white/5 text-gray-400"
                }`}>
                  <Key size={18} />
                </div>
                <span className="text-[10px] text-gray-400 mt-2 font-medium">Device A</span>
              </div>

              {/* Secure Line 1 */}
              <div className="flex-1 h-0.5 mx-2 bg-white/5 relative overflow-hidden">
                {visualStep === 1 && (
                  <motion.div
                    initial={{ left: "0%" }}
                    animate={{ left: "100%" }}
                    transition={{ duration: 1.5, ease: "linear" }}
                    className="absolute top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white"
                  />
                )}
              </div>

              {/* Message Relay (Server) */}
              <div className="flex flex-col items-center z-10">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                  visualStep === 1 || visualStep === 2
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-white/[0.02] border-white/5 text-gray-400"
                }`}>
                  <Server size={18} />
                </div>
                <span className="text-[10px] text-gray-400 mt-2 font-medium">Server Node</span>
              </div>

              {/* Secure Line 2 */}
              <div className="flex-1 h-0.5 mx-2 bg-white/5 relative overflow-hidden">
                {visualStep === 2 && (
                  <motion.div
                    initial={{ left: "0%" }}
                    animate={{ left: "100%" }}
                    transition={{ duration: 1.5, ease: "linear" }}
                    className="absolute top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white"
                  />
                )}
              </div>

              {/* Device B (Recipient) */}
              <div className="flex flex-col items-center z-10">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                  visualStep === 3
                    ? "bg-white text-black border-white"
                    : "bg-white/[0.02] border-white/5 text-gray-400"
                }`}>
                  <Unlock size={18} />
                </div>
                <span className="text-[10px] text-gray-400 mt-2 font-medium">Device B</span>
              </div>
            </div>

            {/* Explanation box based on step */}
            <div className="mt-4 p-3 rounded-xl bg-white/[0.01] border border-white/5 min-h-[50px] flex items-center">
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {visualStep === 0 && "1. Device A drafts a message and locks it locally using a generated 256-bit AES symmetric key."}
                {visualStep === 1 && "2. Encrypted payload (ciphertext + IV) is fired over websockets. The plaintext never leaves Client A."}
                {visualStep === 2 && "3. The Server relays the random ciphertext. The server cannot decode the payload as it lacks the key."}
                {visualStep === 3 && "4. Device B receives the ciphertext and decrypts it locally using the key extracted from the URL hash."}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Interaction Cards */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          
          {/* Interactive Private Vault Console */}
          <div className="w-full rounded-2xl glass-panel p-6 border border-white/5 shadow-xl flex flex-col gap-6">
            
            {/* Create Room Option */}
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Shield size={16} className="text-gray-400" />
                Initiate Private Room
              </h2>
              <p className="text-xs text-gray-400">
                Generate a unique custom room code and a cryptographically secure encryption key in your browser.
              </p>
              <button
                onClick={triggerCreateModal}
                disabled={creatingRoom}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white hover:bg-gray-200 text-black font-semibold text-sm transition-all disabled:opacity-40"
              >
                {creatingRoom ? "Configuring Vault..." : "Create Secure Room"}
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="h-[1px] bg-white/5 flex items-center justify-center">
              <span className="bg-[#0b0f19] px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                or
              </span>
            </div>

            {/* Join Room Option */}
            <form onSubmit={triggerJoinModal} className="space-y-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Key size={16} className="text-gray-400" />
                Join Secure Room
              </h2>
              <p className="text-xs text-gray-400">
                Enter a room code or paste the entire invitation link.
              </p>
              
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value)}
                  placeholder="e.g. SILENT-VAULT-2938"
                  className="w-full glass-input px-3.5 py-2.5 text-sm text-center placeholder-gray-600 focus:placeholder-transparent"
                />
                
                <button
                  type="submit"
                  disabled={joiningRoom || !joinRoomCode.trim()}
                  className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-semibold text-sm transition-all disabled:opacity-30 animate-fade-in"
                >
                  {joiningRoom ? "Connecting..." : "Intercept Invitation"}
                </button>
              </div>
            </form>

            {/* Error notifications */}
            {joinError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 font-medium animate-fade-in">
                {joinError}
              </div>
            )}

          </div>

          {/* Ephemeral Communities Section */}
          <div className="w-full rounded-2xl glass-panel p-6 border border-white/5 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-400" />
                24/7 Security Lounges
              </h2>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Ephemeral, database-free community lobbies. Anyone can join securely with deterministic browser-derived keys.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-1">
              {/* Gaming Hub */}
              <motion.button
                whileHover={{ scale: 1.02, borderColor: "rgba(16, 185, 129, 0.2)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => triggerPublicModal("GAMING-ZONE")}
                className="flex flex-col text-left p-3.5 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2.5 transition-all group-hover:scale-110">
                  <Gamepad2 size={16} />
                </div>
                <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">Gaming Zone</span>
                <span className="text-[10px] text-gray-500 mt-1 leading-normal">Coordinate games and strategies securely.</span>
              </motion.button>

              {/* Free Talk */}
              <motion.button
                whileHover={{ scale: 1.02, borderColor: "rgba(59, 130, 246, 0.2)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => triggerPublicModal("FREE-ZONE")}
                className="flex flex-col text-left p-3.5 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2.5 transition-all group-hover:scale-110">
                  <MessageSquare size={16} />
                </div>
                <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">Free Zone</span>
                <span className="text-[10px] text-gray-500 mt-1 leading-normal">Open channels for general discussion and banter.</span>
              </motion.button>

              {/* Tech Sandbox */}
              <motion.button
                whileHover={{ scale: 1.02, borderColor: "rgba(168, 85, 247, 0.2)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => triggerPublicModal("TECH-ZONE")}
                className="flex flex-col text-left p-3.5 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-2.5 transition-all group-hover:scale-110">
                  <Cpu size={16} />
                </div>
                <span className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">Tech Sandbox</span>
                <span className="text-[10px] text-gray-500 mt-1 leading-normal">Discuss advanced cryptography and protocols.</span>
              </motion.button>

              {/* Dev Lounge */}
              <motion.button
                whileHover={{ scale: 1.02, borderColor: "rgba(99, 102, 241, 0.2)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => triggerPublicModal("DEV-ZONE")}
                className="flex flex-col text-left p-3.5 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2.5 transition-all group-hover:scale-110">
                  <Code size={16} />
                </div>
                <span className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">Dev Lounge</span>
                <span className="text-[10px] text-gray-500 mt-1 leading-normal">Share secure code snippets and build together.</span>
              </motion.button>
            </div>
          </div>

          {/* Core Privacy Pillars Banner */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/[0.01] border border-white/[0.03] p-3">
              <Shield size={14} className="mx-auto text-gray-400 mb-1.5 animate-pulse" />
              <p className="text-[10px] font-semibold text-white">No Database</p>
              <p className="text-[9px] text-gray-500 mt-0.5">Nothing is stored</p>
            </div>
            <div className="rounded-xl bg-white/[0.01] border border-white/[0.03] p-3">
              <Lock size={14} className="mx-auto text-gray-400 mb-1.5 animate-pulse" />
              <p className="text-[10px] font-semibold text-white">Web Crypto</p>
              <p className="text-[9px] text-gray-500 mt-0.5">AES-GCM E2EE</p>
            </div>
            <div className="rounded-xl bg-white/[0.01] border border-white/[0.03] p-3">
              <Key size={14} className="mx-auto text-gray-400 mb-1.5 animate-pulse" />
              <p className="text-[10px] font-semibold text-white">URL Hash Key</p>
              <p className="text-[9px] text-gray-500 mt-0.5">Zero-knowledge relay</p>
            </div>
          </div>

        </div>

      </div>

      {/* Footer Details */}
      <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4 mt-12 pt-6 border-t border-white/5">
        <p className="text-[10px] text-gray-500 leading-relaxed max-w-md">
          CloakChat is an open-source, client-side encrypted communication model. All key exchanges and cryptography happen strictly inside your browser sandbox.
        </p>
        <span className="text-[10px] font-semibold tracking-wider text-gray-400">
          V1.0 MVP — SECURE & ANONYMOUS
        </span>
      </div>

      {/* Stealth Alias Configuration Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md rounded-2xl glass-panel p-6 border border-white/10 shadow-2xl z-10 bg-[#080c14]/95 overflow-hidden"
            >
              {/* Decorative Subtle Glowing Core */}
              <div className="absolute -top-[20%] -right-[20%] w-[150px] h-[150px] rounded-full bg-emerald-500/5 blur-[40px] pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white mx-auto mb-3">
                  {modalType === "public" ? (
                    <Sparkles size={20} className="text-emerald-400" />
                  ) : (
                    <Shield size={20} className="text-emerald-400" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-white tracking-wide">
                  {modalType === "create" && "Configure Secure Vault"}
                  {modalType === "join" && "Join Private Vault"}
                  {modalType === "public" && `Enter ${targetPublicRoom.replace("-", " ")}`}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  All communication is fully encrypted. Establish your session alias.
                </p>
              </div>

              <div className="space-y-4">
                {/* Custom Alias Input */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block pl-1">
                    Your Session Alias
                  </label>
                  <div className="relative flex items-center">
                    <User size={14} className="absolute left-3.5 text-gray-500" />
                    <input
                      type="text"
                      maxLength={20}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="Stealth name..."
                      className="w-full glass-input pl-10 pr-10 py-2.5 text-sm font-semibold text-slate-100 placeholder-gray-600 focus:placeholder-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleRandomizeNickname}
                      className="absolute right-3.5 p-1 rounded-md text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
                      title="Roll new alias"
                    >
                      <Sparkles size={14} />
                    </button>
                  </div>
                </div>

                {/* Custom Room Name (Optional) - Only for creation */}
                {modalType === "create" && (
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block pl-1">
                      Custom Room Name (Optional)
                    </label>
                    <div className="relative flex items-center">
                      <Key size={14} className="absolute left-3.5 text-gray-500" />
                      <input
                        type="text"
                        maxLength={30}
                        value={customRoomName}
                        onChange={(e) => setCustomRoomName(e.target.value)}
                        placeholder="e.g. PROJECT-ALPHA"
                        className="w-full glass-input pl-10 py-2.5 text-sm text-slate-100 placeholder-gray-600 focus:placeholder-transparent uppercase font-mono"
                      />
                    </div>
                    <p className="text-[9px] text-gray-500 pl-1 leading-normal">
                      Leave empty to auto-generate a random secure room code.
                    </p>
                  </div>
                )}

                {/* Submitting Buttons */}
                <div className="pt-2">
                  {modalType === "create" && (
                    <button
                      onClick={handleCreateRoom}
                      disabled={creatingRoom || !nickname.trim()}
                      className="w-full py-3 rounded-xl bg-white hover:bg-gray-200 text-black font-bold text-sm transition-all shadow-[0_4px_20px_rgba(255,255,255,0.06)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      {creatingRoom ? "Configuring Vault..." : "Launch Secure Room"}
                    </button>
                  )}
                  {modalType === "join" && (
                    <button
                      onClick={handleJoinRoom}
                      disabled={joiningRoom || !nickname.trim()}
                      className="w-full py-3 rounded-xl bg-white hover:bg-gray-200 text-black font-bold text-sm transition-all shadow-[0_4px_20px_rgba(255,255,255,0.06)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      {joiningRoom ? "Connecting..." : "Authenticate & Connect"}
                    </button>
                  )}
                  {modalType === "public" && (
                    <button
                      onClick={handleJoinPublicLobby}
                      disabled={!nickname.trim()}
                      className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-[0_4px_20px_rgba(16,185,129,0.2)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      Enter Community Lounge
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
