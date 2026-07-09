import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, Alert, Divider, CircularProgress } from '@mui/material';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../lib/firebase/client';
import { Layers, Globe } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';

function generateRandomString(length: number) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += charset[array[i] % charset.length];
  }
  return result;
}

async function generateCodeChallenge(verifier: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  const GOOGLE_IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID;

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  // iOS OAuth clients use PKCE only (no client secret); desktop uses the loopback flow.
  const isGoogleAvailable = isIos
    ? Boolean(GOOGLE_IOS_CLIENT_ID)
    : Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

  // iOS: custom URL scheme + deep link (ASWebAuthenticationSession-style) PKCE flow.
  // The loopback (127.0.0.1) approach used on desktop cannot work on iOS.
  const handleGoogleLoginIos = async () => {
    setError('');
    if (!GOOGLE_IOS_CLIENT_ID) {
      setError('Configuration Error: VITE_GOOGLE_IOS_CLIENT_ID is missing.');
      return;
    }
    setGoogleLoading(true);
    let unlisten: (() => void) | undefined;
    try {
      const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');

      // Reversed iOS client ID is the registered custom URL scheme (see Info.plist).
      const reversedId = GOOGLE_IOS_CLIENT_ID.replace(/\.apps\.googleusercontent\.com$/, '');
      const redirectScheme = `com.googleusercontent.apps.${reversedId}`;
      const redirectUri = `${redirectScheme}:/oauth2redirect`;

      const codeVerifier = generateRandomString(64);
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      let resolveCode!: (code: string) => void;
      let rejectCode!: (err: Error) => void;
      const codePromise = new Promise<string>((resolve, reject) => {
        resolveCode = resolve;
        rejectCode = reject;
      });

      // Register the deep-link listener BEFORE opening the browser so we don't miss the callback.
      unlisten = await onOpenUrl((urls) => {
        const url = urls.find((u) => u.startsWith(redirectScheme)) ?? urls[0];
        if (!url) return;
        const queryString = url.includes('?') ? url.split('?').slice(1).join('?') : '';
        const params = new URLSearchParams(queryString);
        const code = params.get('code');
        const errorParam = params.get('error');
        if (errorParam) rejectCode(new Error(`OAuth Error: ${errorParam}`));
        else if (code) resolveCode(code);
      });

      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth' +
        `?client_id=${encodeURIComponent(GOOGLE_IOS_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        '&response_type=code' +
        `&scope=${encodeURIComponent('email profile openid')}` +
        `&code_challenge=${codeChallenge}` +
        '&code_challenge_method=S256';

      await openUrl(authUrl);

      const code = await codePromise;

      // iOS OAuth clients have NO client_secret — token exchange uses PKCE (code_verifier) only.
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_IOS_CLIENT_ID,
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        throw new Error(errorData.error_description || 'Token exchange failed');
      }

      const tokenData = await tokenResponse.json();
      const idToken = tokenData.id_token;
      if (!idToken) {
        throw new Error('No id_token received in token response.');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Auth failed');
    } finally {
      unlisten?.();
      setGoogleLoading(false);
    }
  };

  const handleGoogleLoginDesktop = async () => {
    setError('');
    if (!isGoogleAvailable) {
      setError('Configuration Error: VITE_GOOGLE_CLIENT_ID is missing.');
      return;
    }
    setGoogleLoading(true);
    try {
      const codeVerifier = generateRandomString(64);
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Listen for the rust backend starting the server to open the browser
      const unlisten = await listen<number>('oauth-started', (event) => {
        const port = event.payload;
        const redirectUri = `http://127.0.0.1:${port}`;
        // Google OAuth URL (PKCE Authorization code flow)
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email profile openid&code_challenge=${codeChallenge}&code_challenge_method=S256`;
        
        console.log('=== OAUTH REQUEST INFO ===');
        console.log('client_id:', GOOGLE_CLIENT_ID);
        console.log('redirect_uri:', redirectUri);
        console.log('response_type:', 'code');
        console.log('Full authUrl:', authUrl);
        console.log('==========================');

        openUrl(authUrl);
      });

      // Start the blocking Rust command
      const callbackPath: string = await invoke('perform_oauth_loopback');
      unlisten();

      const params = new URLSearchParams(callbackPath.replace('/?', ''));
      const code = params.get('code');
      const errorParam = params.get('error');

      if (errorParam) {
        throw new Error(`OAuth Error: ${errorParam}`);
      }
      if (!code) {
        throw new Error('No authorization code received.');
      }

      // Exchange code for token
      console.log('=== TOKEN REQUEST BODY ===');
      console.log({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code: `${code.substring(0, 5)}...`,
        code_verifier: codeVerifier,
        redirect_uri: 'http://127.0.0.1:14205',
        grant_type: 'authorization_code',
      });
      console.log('==========================');

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          code_verifier: codeVerifier,
          redirect_uri: 'http://127.0.0.1:14205',
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error_description || 'Token exchange failed');
      }

      const tokenData = await tokenResponse.json();
      const idToken = tokenData.id_token;

      if (!idToken) {
        throw new Error('No id_token received in token response.');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Auth failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLogin = isIos ? handleGoogleLoginIos : handleGoogleLoginDesktop;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" height="100vh" alignItems="center" justifyContent="center" bgcolor="background.default">
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <Box display="flex" justifyContent="center" mb={2}>
          <Layers size={48} color="#90caf9" />
        </Box>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          SEKKEIYA Desktop
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Sign in with your SEKKEIYA account
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {googleLoading ? (
          <Box sx={{ my: 4 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2 }}>Waiting for browser authentication...</Typography>
          </Box>
        ) : (
          <>
            <Button
              fullWidth
              variant="outlined"
              color="primary"
              size="large"
              startIcon={<Globe />}
              onClick={handleGoogleLogin}
              sx={{ mb: isGoogleAvailable ? 3 : 1 }}
              disabled={!isGoogleAvailable || googleLoading}
            >
              Sign in with Google
            </Button>
            {!isGoogleAvailable && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mb: 3, textAlign: 'center' }}>
                Google Login is disabled (Client ID missing)
              </Typography>
            )}

            <Divider sx={{ mb: 3 }}>OR</Divider>

            <form onSubmit={handleLogin}>
              <TextField
            fullWidth
            label="Email"
            variant="outlined"
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            variant="outlined"
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Button
            fullWidth
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In Email'}
          </Button>
        </form>
        </>
        )}
      </Paper>
    </Box>
  );
};

export default Login;
