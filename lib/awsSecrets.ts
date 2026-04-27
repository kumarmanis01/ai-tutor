import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from '@/lib/logger';

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const secretsManagerClient = new SecretsManagerClient({ region });

export type PresignCreds = { accessKeyId?: string; secretAccessKey?: string } | null;

/**
 * Fetch a secret's raw string value from AWS Secrets Manager.
 * Returns null on any error or if secret is not found.
 */
export async function getSecret(secretName: string): Promise<string | null> {
  if (!secretName) return null;
  try {
    const cmd = new GetSecretValueCommand({ SecretId: secretName });
    const result = await secretsManagerClient.send(cmd);

    if (typeof result.SecretString === 'string' && result.SecretString.length > 0) {
      return result.SecretString;
    }

    if (result.SecretBinary) {
      // SecretBinary may come as a Uint8Array or base64-encoded string depending on runtime
      // If it's a Uint8Array (v3 may return binary as Uint8Array), convert it.
      const bin: any = result.SecretBinary as any;
      if (typeof bin === 'string') {
        return Buffer.from(bin, 'base64').toString('utf8');
      }
    try {
      return Buffer.from(bin).toString('utf8');
    } catch (error) {
      logger.error(`[awsSecrets] Error decoding SecretBinary: ${String(error)}`, { className: 'awsSecrets', methodName: 'getSecret' });
      return null;
    }
    }

    return null;
  } catch (error) {
    // Non-fatal: log and return null
    logger.error(`[awsSecrets] getSecret error: ${String(error)}`, { className: 'awsSecrets', methodName: 'getSecret' });
    return null;
  }
}

/**
 * Fetch a secret and parse it as JSON.
 * Returns null if parsing fails or secret is missing.
 */
export async function getJsonSecret<T = unknown>(secretName: string): Promise<T | null> {
  const raw = await getSecret(secretName);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.error(`[awsSecrets] getJsonSecret parse error for ${secretName}: ${String(err)}`, { className: 'awsSecrets', methodName: 'getJsonSecret' });
    return null;
  }
}

/**
 * Read the presign credentials secret and return parsed access keys.
 * Returns null if not found or parse fails.
 */
export async function getPresignCredentials(): Promise<PresignCreds> {
  // Only attempt to fetch from Secrets Manager when an explicit secret name
  // is provided via `PRESIGN_SECRET_NAME`. This avoids the AWS SDK trying
  // to discover credentials (IMDS / role) in local/dev environments and
  // causing timeouts/noisy errors when secrets are intentionally not used.
  const secretName = process.env.PRESIGN_SECRET_NAME;
  if (!secretName) return null;

  const raw = await getSecret(secretName);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as any;
    return {
      accessKeyId: parsed.AWS_ACCESS_KEY_ID || parsed.accessKeyId || parsed.access_key_id,
      secretAccessKey: parsed.AWS_SECRET_ACCESS_KEY || parsed.secretAccessKey || parsed.secret_access_key,
    };
  } catch (err) {
    logger.error(`[awsSecrets] getPresignCredentials parse error: ${String(err)}`, { className: 'awsSecrets', methodName: 'getPresignCredentials' });
    return null;
  }
}