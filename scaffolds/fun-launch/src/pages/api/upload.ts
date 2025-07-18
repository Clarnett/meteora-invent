import { NextApiRequest, NextApiResponse } from 'next';
import AWS from 'aws-sdk';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';

/** ✅ Load Required Env Vars */
const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_ACCOUNT_ID,
  R2_BUCKET,
  RPC_URL,
  POOL_CONFIG_KEY,
} = process.env;

if (
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_ACCOUNT_ID ||
  !R2_BUCKET ||
  !RPC_URL ||
  !POOL_CONFIG_KEY
) {
  throw new Error('❌ Missing required environment variables for R2 or Pool Config');
}

/** ✅ R2 Private & Public URLs */
const PRIVATE_R2_URL = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const PUBLIC_R2_URL = `https://${R2_BUCKET}.r2.dev`;

/** ✅ API Request Types */
type UploadRequest = {
  tokenLogo: string; // Base64 encoded image
  tokenName: string;
  tokenSymbol: string;
  mint: string;      // Token mint address
  userWallet: string; // User wallet address
};

type Metadata = {
  name: string;
  symbol: string;
  image: string;
};

type MetadataUploadParams = {
  tokenName: string;
  tokenSymbol: string;
  mint: string;
  image: string;
};

/** ✅ Setup Cloudflare R2 S3 Client */
const r2 = new AWS.S3({
  endpoint: PRIVATE_R2_URL,
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  region: 'auto',
  signatureVersion: 'v4',
});

/**
 * ✅ Main Handler for Pool Creation
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { tokenLogo, tokenName, tokenSymbol, mint, userWallet } = req.body as UploadRequest;

    // ✅ Validate required fields
    if (!tokenLogo || !tokenName || !tokenSymbol || !mint || !userWallet) {
      return res.status(400).json({ error: 'Missing required fields in request' });
    }

    // ✅ Upload Token Logo → R2
    const imageUrl = await uploadImageToR2(tokenLogo, mint);
    if (!imageUrl) return res.status(400).json({ error: 'Failed to upload image' });

    // ✅ Upload Metadata JSON → R2
    const metadataUrl = await uploadMetadataToR2({
      tokenName,
      tokenSymbol,
      mint,
      image: imageUrl,
    });
    if (!metadataUrl) return res.status(400).json({ error: 'Failed to upload metadata' });

    // ✅ Create Pool Transaction using Meteora DBC
    const poolTx = await createPoolTransaction({
      mint,
      tokenName,
      tokenSymbol,
      metadataUrl,
      userWallet,
    });

    // ✅ Return Serialized Tx for Frontend Signing
    return res.status(200).json({
      success: true,
      metadataUrl,
      poolTx: poolTx
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('base64'),
    });
  } catch (error) {
    console.error('❌ Pool creation error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * ✅ Upload Base64 Token Logo to R2
 */
async function uploadImageToR2(base64Image: string, mint: string): Promise<string | false> {
  const matches = base64Image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return false;

  const [, contentType, base64Data] = matches;
  if (!contentType || !base64Data) return false;

  const fileBuffer = Buffer.from(base64Data, 'base64');
  const extension = contentType.split('/')[1];
  const fileName = `images/${mint}.${extension}`;

  try {
    await putToR2(fileBuffer, contentType, fileName);
    return `${PUBLIC_R2_URL}/${fileName}`;
  } catch (err) {
    console.error('❌ Image upload failed:', err);
    return false;
  }
}

/**
 * ✅ Upload Metadata JSON to R2
 */
async function uploadMetadataToR2(params: MetadataUploadParams): Promise<string | false> {
  const metadata: Metadata = {
    name: params.tokenName,
    symbol: params.tokenSymbol,
    image: params.image,
  };
  const fileName = `metadata/${params.mint}.json`;

  try {
    await putToR2(Buffer.from(JSON.stringify(metadata, null, 2)), 'application/json', fileName);
    return `${PUBLIC_R2_URL}/${fileName}`;
  } catch (err) {
    console.error('❌ Metadata upload failed:', err);
    return false;
  }
}

/**
 * ✅ Helper to Upload Any File to R2
 */
async function putToR2(
  fileBuffer: Buffer,
  contentType: string,
  fileName: string
): Promise<AWS.S3.PutObjectOutput> {
  return new Promise((resolve, reject) => {
    r2.putObject(
      {
        Bucket: R2_BUCKET!,
        Key: fileName,
        Body: fileBuffer,
        ContentType: contentType,
      },
      (err, data) => {
        if (err) reject(err);
        else resolve(data);
      }
    );
  });
}

/**
 * ✅ Create Meteora DBC Pool Transaction
 */
async function createPoolTransaction({
  mint,
  tokenName,
  tokenSymbol,
  metadataUrl,
  userWallet,
}: {
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  metadataUrl: string;
  userWallet: string;
}): Promise<Transaction> {
  const connection = new Connection(RPC_URL!, 'confirmed');
  const client = new DynamicBondingCurveClient(connection, 'confirmed');

  const poolTx = await client.pool.createPool({
    config: new PublicKey(POOL_CONFIG_KEY!),
    baseMint: new PublicKey(mint),
    name: tokenName,
    symbol: tokenSymbol,
    uri: metadataUrl,
    payer: new PublicKey(userWallet),
    poolCreator: new PublicKey(userWallet),
  });

  // ✅ Add recent blockhash & fee payer
  const { blockhash } = await connection.getLatestBlockhash();
  poolTx.feePayer = new PublicKey(userWallet);
  poolTx.recentBlockhash = blockhash;

  return poolTx;
}
