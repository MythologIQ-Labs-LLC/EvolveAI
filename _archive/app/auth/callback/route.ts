import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  // Support dynamic redirect_uri
  const redirectUri = searchParams.get('redirect_uri') || `${request.nextUrl.origin}/auth/callback`;

  if (error) {
    return NextResponse.redirect(new URL('/settings?error=oauth_denied', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=no_code', request.url));
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      return NextResponse.redirect(new URL('/settings?error=token_exchange_failed', request.url));
    }

    // Store the access token securely (in a real app, this would be in a database)
    // For now, we'll redirect with the token in the URL (not secure for production)
    return NextResponse.redirect(new URL(`/settings?access_token=${tokenData.access_token}`, request.url));

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/settings?error=oauth_error', request.url));
  }
} 