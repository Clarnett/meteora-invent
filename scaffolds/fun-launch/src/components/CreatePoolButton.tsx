"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { Button } from "@/components/ui/button";

export function CreatePoolButton() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction } = useWallet();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleCreatePool() {
    if (!publicKey || !signTransaction) {
      setStatus("Please connect your wallet first");
      return;
    }

    try {
      setLoading(true);
      setStatus("Uploading metadata & creating transaction...");

      // ✅ Replace with real inputs
      const tokenLogoBase64 = "data:image/png;base64,...."; // TODO: Pick from file input
      const tokenName = "MyToken";
      const tokenSymbol = "MYT";
      const mintAddress = "YOUR_MINT_PUBKEY_HERE";

      const res = await fetch("/api/create-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenLogo: tokenLogoBase64,
          tokenName,
          tokenSymbol,
          mint: mintAddress,
          userWallet: publicKey.toBase58(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create pool");
      }

      setStatus("Signing pool transaction...");
      const tx = Transaction.from(Buffer.from(data.poolTx, "base64"));
      const signedTx = await signTransaction(tx);

      setStatus("Sending transaction...");
      const sig = await connection.sendRawTransaction(signedTx.serialize());

      await connection.confirmTransaction(sig, "confirmed");
      setStatus(`✅ Pool launched successfully! Tx: ${sig}`);
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      <Button
        onClick={handleCreatePool}
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
      >
        {loading ? "Launching..." : "🚀 Launch Pool"}
      </Button>

      {status && (
        <p className="text-sm text-center text-gray-200">
          {status}
        </p>
      )}
    </div>
  );
}
