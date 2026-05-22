import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

export interface EncryptedMessagePayload {
  senderId?: string;
  ciphertext: string;
  iv: string;
  timestamp: number;
  selfDestructDuration?: number;
}

export type ConnectionState = "connecting" | "waiting" | "ready" | "full" | "disconnected" | "error";

/**
 * Socket.IO React integration hook for E2EE and group-based E2EE communications.
 */
export function useSocket(
  roomId: string | undefined,
  nickname: string | null,
  onWebRTCSignal?: (payload: { senderId: string; signal: any }) => void,
  onPeerJoined?: (peerId: string, nickname: string) => void,
  onPeerLeft?: (peerId: string, nickname: string) => void
) {
  const socketRef = useRef<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  
  // Backward compatibility typing states
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerNickname, setPeerNickname] = useState<string | null>(null);
  
  // Group-aware multi-peer states
  const [peers, setPeers] = useState<Record<string, string>>({});
  const [typingPeers, setTypingPeers] = useState<Record<string, string>>({});

  const [inboundMessage, setInboundMessage] = useState<EncryptedMessagePayload | null>(null);
  const [readReceiptMsgId, setReadReceiptMsgId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onWebRTCSignalRef = useRef(onWebRTCSignal);
  const onPeerJoinedRef = useRef(onPeerJoined);
  const onPeerLeftRef = useRef(onPeerLeft);

  useEffect(() => {
    onWebRTCSignalRef.current = onWebRTCSignal;
    onPeerJoinedRef.current = onPeerJoined;
    onPeerLeftRef.current = onPeerLeft;
  }, [onWebRTCSignal, onPeerJoined, onPeerLeft]);

  // Keep a ref of peers for direct synchronous lookup inside event handlers
  const peersRef = useRef<Record<string, string>>({});
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    if (!roomId || !nickname) return;

    setConnectionState("connecting");
    setErrorMessage(null);

    // Establish Socket connection with automatic reconnection rules
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    // Standard Socket Events
    socket.on("connect", () => {
      socket.emit("join-room", { roomId, nickname });
    });

    socket.on("connect_error", () => {
      setConnectionState("error");
      setErrorMessage("Could not connect to secure message relay.");
    });

    // Room specific Events
    socket.on("waiting-for-peer", () => {
      setConnectionState("waiting");
      setPeerId(null);
      setPeerNickname(null);
      setPeers({});
    });

    socket.on("peer-joined", ({ peerId, nickname }: { peerId: string; nickname?: string }) => {
      const name = nickname || "Anonymous";
      setPeerId(peerId);
      setPeerNickname(name);
      setPeers((prev) => ({ ...prev, [peerId]: name }));
      if (onPeerJoinedRef.current) {
        onPeerJoinedRef.current(peerId, name);
      }
    });

    socket.on("room-ready", ({ nicknames }: { nicknames?: Record<string, string> }) => {
      setConnectionState("ready");
      if (nicknames && socket.id) {
        // Exclude our own socket ID from the peers list
        const peersOnly = { ...nicknames };
        delete peersOnly[socket.id];
        
        setPeers(peersOnly);

        // Prefill single peer for 1-on-1 backward compatibility
        const firstPeerId = Object.keys(peersOnly)[0];
        if (firstPeerId) {
          setPeerId(firstPeerId);
          setPeerNickname(peersOnly[firstPeerId]);
        }
      }
    });

    socket.on("room-full", () => {
      setConnectionState("full");
      socket.disconnect();
    });

    socket.on("error-message", ({ message }: { message: string }) => {
      setConnectionState("error");
      setErrorMessage(message);
    });

    // Inbound Encrypted Messages
    socket.on("encrypted-message", (payload: EncryptedMessagePayload) => {
      setInboundMessage(payload);
    });

    // Typing indicators supporting multi-user environments
    socket.on("peer-typing", ({ senderId, nickname: peerName, isTyping }: { senderId?: string; nickname?: string; isTyping: boolean }) => {
      if (senderId) {
        setTypingPeers((prev) => {
          const updated = { ...prev };
          if (isTyping) {
            updated[senderId] = peerName || "Anonymous";
          } else {
            delete updated[senderId];
          }
          return updated;
        });
      }
      
      // Backward compatible single peer state
      setIsPeerTyping(isTyping);
    });

    socket.on("message-read", ({ messageId }: { messageId: string }) => {
      setReadReceiptMsgId(messageId);
    });

    socket.on("webrtc-signal", (payload: { senderId: string; signal: any }) => {
      console.log("[SOCKET] webrtc-signal received:", payload);
      if (onWebRTCSignalRef.current) {
        onWebRTCSignalRef.current(payload);
      }
    });

    socket.on("peer-left", ({ peerId: leftPeerId }: { peerId?: string }) => {
      if (leftPeerId) {
        const nameOfLeftPeer = peersRef.current[leftPeerId] || "Secure Partner";
        setPeers((prev) => {
          const updated = { ...prev };
          delete updated[leftPeerId];
          return updated;
        });
        setTypingPeers((prev) => {
          const updated = { ...prev };
          delete updated[leftPeerId];
          return updated;
        });
        if (onPeerLeftRef.current) {
          onPeerLeftRef.current(leftPeerId, nameOfLeftPeer);
        }
      } else {
        // Fallback for private rooms / old server payloads
        const nameOfLeftPeer = peerNickname || "Secure Partner";
        const targetPeerId = peerId || "";
        setConnectionState("waiting");
        setPeerId(null);
        setPeerNickname(null);
        setPeers({});
        setTypingPeers({});
        setIsPeerTyping(false);
        if (onPeerLeftRef.current) {
          onPeerLeftRef.current(targetPeerId, nameOfLeftPeer);
        }
      }
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
    });

    // Clean up on component unmount
    return () => {
      socket.emit("leave-room", { roomId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, nickname]);

  /**
   * Encrypts and transmits a payload through the socket.
   */
  const sendEncryptedMessage = useCallback((
    ciphertext: string,
    iv: string,
    selfDestructDuration?: number
  ) => {
    if (!socketRef.current || !roomId) return;

    socketRef.current.emit("send-encrypted-message", {
      roomId,
      ciphertext,
      iv,
      timestamp: Date.now(),
      selfDestructDuration,
    });
  }, [roomId]);

  /**
   * Disseminates typing status changes.
   */
  const sendTypingState = useCallback((isTyping: boolean) => {
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit("typing-state", { roomId, isTyping });
  }, [roomId]);

  /**
   * Disseminates message read confirmation.
   */
  const sendReadReceipt = useCallback((messageId: string) => {
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit("read-receipt", { roomId, messageId });
  }, [roomId]);

  /**
   * Manually exit room.
   */
  const leaveRoom = useCallback(() => {
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit("leave-room", { roomId });
    socketRef.current.disconnect();
  }, [roomId]);

  /**
   * Transmits WebRTC signaling metadata (SDP offers/answers and ICE candidates).
   */
  const sendWebRTCSignal = useCallback((signal: any) => {
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit("webrtc-signal", { roomId, signal });
  }, [roomId]);

  return {
    connectionState,
    isPeerTyping,
    peerId,
    peerNickname,
    activePeers: peers,
    typingPeers,
    inboundMessage,
    readReceiptMsgId,
    errorMessage,
    sendEncryptedMessage,
    sendTypingState,
    sendReadReceipt,
    sendWebRTCSignal,
    leaveRoom,
  };
}
