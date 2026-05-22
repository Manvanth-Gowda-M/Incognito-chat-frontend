import { useCallback } from "react";

/**
 * Web Crypto API AES-GCM (256-bit) client-side encryption hook.
 * Handles secure random keys, URL hash serialization, and encryption/decryption.
 */
export function useCrypto() {
  /**
   * Generates a new 256-bit cryptographically secure symmetric key.
   */
  const generateEncryptionKey = useCallback(async (): Promise<CryptoKey> => {
    return await window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true, // exportable
      ["encrypt", "decrypt"]
    );
  }, []);

  /**
   * Exports a CryptoKey into a URL-safe Base64URL string.
   */
  const exportKeyToBase64 = useCallback(async (key: CryptoKey): Promise<string> => {
    const rawKey = await window.crypto.subtle.exportKey("raw", key);
    const keyArray = Array.from(new Uint8Array(rawKey));
    // Safe standard conversion to base64
    const base64 = btoa(String.fromCharCode(...keyArray));
    // Transform base64 into base64url format for neat URL hashes
    return base64
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }, []);

  /**
   * Imports a CryptoKey from a URL-safe Base64URL string.
   */
  const importKeyFromBase64 = useCallback(async (base64url: string): Promise<CryptoKey> => {
    // Reconstruct standard base64 format from base64url
    let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) {
      base64 += "=".repeat(4 - pad);
    }

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    return await window.crypto.subtle.importKey(
      "raw",
      bytes,
      "AES-GCM",
      true, // exportable
      ["encrypt", "decrypt"]
    );
  }, []);

  /**
   * Derives a deterministic CryptoKey from a seed string (e.g. public lobby name).
   * Uses SHA-256 to hash the seed, then imports it as a raw AES-GCM key.
   */
  const deriveKeyFromString = useCallback(async (seed: string): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(seed);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    
    return await window.crypto.subtle.importKey(
      "raw",
      hashBuffer,
      "AES-GCM",
      true, // exportable
      ["encrypt", "decrypt"]
    );
  }, []);

  /**
   * Encrypts a plaintext message using AES-GCM.
   * Returns base64 encoded ciphertext and 12-byte initialization vector (IV).
   */
  const encryptMessage = useCallback(async (
    plaintext: string,
    key: CryptoKey
  ): Promise<{ ciphertext: string; iv: string }> => {
    // Generate a unique 12-byte random initialization vector (IV) for AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedPlaintext = encoder.encode(plaintext);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encodedPlaintext
    );

    // Convert ciphertext buffer and IV to base64 for transmission
    const ciphertextArray = Array.from(new Uint8Array(ciphertextBuffer));
    const ciphertextBase64 = btoa(String.fromCharCode(...ciphertextArray));
    
    const ivArray = Array.from(iv);
    const ivBase64 = btoa(String.fromCharCode(...ivArray));

    return {
      ciphertext: ciphertextBase64,
      iv: ivBase64,
    };
  }, []);

  /**
   * Decrypts an AES-GCM encrypted ciphertext back to UTF-8 plaintext.
   */
  const decryptMessage = useCallback(async (
    ciphertextBase64: string,
    ivBase64: string,
    key: CryptoKey
  ): Promise<string> => {
    // Decode base64 ciphertext to Uint8Array
    const ciphertextBinary = atob(ciphertextBase64);
    const ciphertextBytes = new Uint8Array(ciphertextBinary.length);
    for (let i = 0; i < ciphertextBinary.length; i++) {
      ciphertextBytes[i] = ciphertextBinary.charCodeAt(i);
    }

    // Decode base64 IV to Uint8Array
    const ivBinary = atob(ivBase64);
    const ivBytes = new Uint8Array(ivBinary.length);
    for (let i = 0; i < ivBinary.length; i++) {
      ivBytes[i] = ivBinary.charCodeAt(i);
    }

    // Decrypt using Web Crypto API
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBytes,
      },
      key,
      ciphertextBytes
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }, []);

  return {
    generateEncryptionKey,
    exportKeyToBase64,
    importKeyFromBase64,
    deriveKeyFromString,
    encryptMessage,
    decryptMessage,
  };
}
