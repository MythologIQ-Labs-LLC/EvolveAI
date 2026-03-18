import React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "EvolveAI - Advanced AI Desktop Application",
  description: "The most comprehensive AI desktop application with hybrid architecture, multi-AI collaboration, and unlimited extensibility.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Initialize logging when available
  if (typeof window !== 'undefined') {
    // Log application start
    console.log('[APP] EvolveAI application started', {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });

    // Log any unhandled errors
    window.addEventListener('error', (event) => {
      console.error('[APP] Unhandled JavaScript error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    // Log unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[APP] Unhandled promise rejection:', {
        reason: event.reason
      });
    });

    // Log page visibility changes
    document.addEventListener('visibilitychange', () => {
      console.log('[APP] Page visibility changed:', {
        hidden: document.hidden,
        timestamp: new Date().toISOString()
      });
    });
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
