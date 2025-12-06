"use client";

/* eslint-disable react/display-name */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { logger } from '@/lib/logger';

type OtpProviderProps = {
  widgetId: string;
  tokenAuth: string;
  identifier?: string;
  onIdentifierChange?: (id: string) => void;
  exposeMethods?: boolean;
  autoVerify?: boolean;
  onSuccess?: (data: any) => void;
  onFailure?: (err: any) => void;
};

export type OtpProviderHandle = {
  callMethod: (method: string, ...args: any[]) => any;
};

/**
 * OtpProviderForm
 * - Loads the external OTP provider script from MSG91 and initializes it with the provided config.
 * - Renders a small form to enter mobile/email (identifier) and a button to initialize/send OTP.
 * - If `exposeMethods` is true, exposes a `callMethod` helper via ref to call any globally-exposed methods.
 *
 * Usage:
 * <OtpProviderForm widgetId="..." tokenAuth="..." />
 */
const OtpProviderForm = forwardRef<OtpProviderHandle, OtpProviderProps>(
  ({
    widgetId,
    tokenAuth,
    identifier: initialIdentifier,
    onIdentifierChange,
    exposeMethods = false,
    autoVerify = true,
    onSuccess,
    onFailure,
  }, ref) => {
    const [identifier, setIdentifier] = useState(initialIdentifier || "");
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const scriptRef = useRef<HTMLScriptElement | null>(null);

    // Build config to be passed to the provider
      const buildConfig = () => ({
      widgetId,
      tokenAuth,
      identifier: identifier || undefined,
      exposeMethods: exposeMethods ? "true" : "false",
      success: async (data: any) => {
        try {
          // Extract token and phone/identifier robustly so callers receive structured info
          const tokenKeys = ['token', 'accessToken', 'access-token', 'access_token'];
          const phoneKeys = ['identifier', 'mobile', 'phone', 'number', 'msisdn', 'identifierValue'];

          let token: string | undefined;
          let phone: string | undefined;

          // Top-level string payload may be a token
          if (typeof data === 'string') token = data;

          if (data && typeof data === 'object') {
            for (const k of tokenKeys) {
              if ((data as any)[k]) { token = String((data as any)[k]); break; }
            }
            if (!token && (data as any).data && typeof (data as any).data === 'object') {
              for (const k of tokenKeys) {
                if ((data as any).data[k]) { token = String((data as any).data[k]); break; }
              }
            }

            for (const k of phoneKeys) {
              if ((data as any)[k]) { phone = String((data as any)[k]); break; }
            }
            if (!phone && (data as any).data && typeof (data as any).data === 'object') {
              for (const k of phoneKeys) {
                if ((data as any).data[k]) { phone = String((data as any).data[k]); break; }
              }
            }
          }

          // Log the payload and extracted values for observability in the browser console
          logger.info('[OtpProvider] success payload', { className: 'OtpProviderForm', methodName: 'success', raw: data, token, phone });

          // Return a structured object to the onSuccess handler so callers can rely on token/phone
          onSuccess?.({ raw: data, token, phone });

          // If configured, attempt server-side verification of the widget token.
          if (autoVerify && token) {
            try {
              logger.info('[OtpProvider] autoVerify sending token to server', { className: 'OtpProviderForm', methodName: 'success', tokenSnippet: String(token).slice(-8) });
              const resp = await fetch('/api/msg91/verify-access-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: token }),
              });
              const json = await resp.json().catch(() => ({}));
              logger.info('[OtpProvider] verify response', { className: 'OtpProviderForm', methodName: 'verify', status: resp.status, ok: resp.ok, json });
              if (!resp.ok) {
                onFailure?.(json || new Error('verify failed'));
              }
            } catch (e) {
              // non-fatal; surface to onFailure
              logger.warn('auto verify failed', { className: 'OtpProviderForm', methodName: 'verify', error: String(e) });
              onFailure?.(e);
            }
          } else if (autoVerify && !token) {
            logger.warn('[OtpProvider] autoVerify enabled but token not found in payload', { className: 'OtpProviderForm', methodName: 'success', raw: data });
          }
        } catch (e) {
          onFailure?.(e);
        }
      },
      failure: (err: any) => {
        onFailure?.(err);
      },
    });

    // Load external script dynamically and initialize
    const loadProvider = () => {
      if (loaded || loading) return;
      setLoading(true);

      // If script already added, try to init directly
      if ((window as any).initSendOTP) {
        try {
          (window as any).initSendOTP(buildConfig());
          setLoaded(true);
        } catch (e) {
          logger.error("initSendOTP failed", { className: 'OtpProviderForm', methodName: 'loadProvider', error: String(e) });
          onFailure?.(e);
        } finally {
          setLoading(false);
        }
        return;
      }

      const script = document.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.src = "https://verify.msg91.com/otp-provider.js";
      script.onload = () => {
        try {
          // The provider exposes a global `initSendOTP` per their docs.
          if ((window as any).initSendOTP) {
            (window as any).initSendOTP(buildConfig());
            setLoaded(true);
          } else {
            logger.warn("OTP provider script loaded but initSendOTP not found", { className: 'OtpProviderForm', methodName: 'script.onload' });
            onFailure?.(new Error("initSendOTP not found after script load"));
          }
        } catch (e) {
          logger.error("initSendOTP call failed", { className: 'OtpProviderForm', methodName: 'script.onload', error: String(e) });
          onFailure?.(e);
        } finally {
          setLoading(false);
        }
      };
      script.onerror = (e) => {
        logger.error("Failed to load OTP provider script", { className: 'OtpProviderForm', methodName: 'script.onerror', error: String(e as any) });
        setLoading(false);
        onFailure?.(new Error("Failed to load OTP provider script"));
      };

      scriptRef.current = script;
      document.body.appendChild(script);
    };

    useEffect(() => {
      return () => {
        // cleanup script if we added it
        if (scriptRef.current && scriptRef.current.parentNode) {
          scriptRef.current.parentNode.removeChild(scriptRef.current);
        }
      };
    }, []);

    // Expose generic method caller if requested
    useImperativeHandle(
      ref,
      () => ({
        callMethod: (method: string, ...args: any[]) => {
          // Try to resolve method on window first, then on a provider namespace if available
          const globalFn = (window as any)[method];
          if (typeof globalFn === "function") {
            return globalFn(...args);
          }
          // Some providers expose an object, try common names
          const provider = (window as any).MSG91 || (window as any).otpProvider || (window as any).OtpProvider;
          const providerFn = provider?.[method];
          if (typeof providerFn === "function") return providerFn(...args);
          throw new Error(`Method ${method} not found on window or provider`);
        },
      }),
      []
    );

    return (
      <div className="w-full max-w-lg mx-auto">
        {/* <label className="block text-sm font-medium text-foreground mb-2">
          Mobile number or email</label> */}
          <label className="block font-body font-medium text-sm text-foreground mb-2">
                  Mobile Number (मोबाइल नंबर)
                </label>
        <div className="flex gap-2">
          
          <input
            value={identifier}
            onChange={(e) => {
              const v = e.target.value;
              setIdentifier(v);
              try {
                onIdentifierChange?.(v);
              } catch (e) {
                // swallow any callback errors to avoid breaking the input
                logger.warn('onIdentifierChange callback errored', { className: 'OtpProviderForm', methodName: 'onIdentifierChange', error: String(e) });
              }
            }}
            placeholder={"Enter mobile number or email"}
            className="flex-1 px-3 py-2 border rounded-md"
          />
          <button
            type="button"
            onClick={() => {
              loadProvider();
            }}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-50"
          >
            {loaded ? "Provider Ready" : loading ? "Loading…" : "Send OTP"}
          </button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          We will initialize and attempt to send an One Time Password (OTP) to
          the number above.
        </p>
      </div>
    );
  }
);

// Provide a display name to satisfy eslint/react rules for forwardRef components
;(OtpProviderForm as any).displayName = 'OtpProviderForm';

export default OtpProviderForm;
