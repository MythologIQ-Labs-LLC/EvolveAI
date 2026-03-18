import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const currentVersion = '1.0.0' // This should come from package.json or app config
    
    // GitHub API configuration
    const GITHUB_OWNER = 'WulfForge'
    const GITHUB_REPO = 'EvolveAI'

    // Get latest release from GitHub
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'EvolveAI-Update-Checker'
        },
      }
    )

    if (!response.ok) {
      // If GitHub API fails, return current version info
      return NextResponse.json({
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        error: 'Unable to check for updates'
      })
    }

    const release = await response.json()
    const latestVersion = release.tag_name.replace('v', '') // Remove 'v' prefix if present
    
    // Simple version comparison (you might want to use a proper semver library)
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0

    return NextResponse.json({
      currentVersion,
      latestVersion,
      hasUpdate,
      releaseNotes: release.body,
      downloadUrl: release.html_url,
      publishedAt: release.published_at
    })

  } catch (error) {
    console.error('Error checking for updates:', error)
    return NextResponse.json({
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      hasUpdate: false,
      error: 'Failed to check for updates'
    })
  }
}

// Simple version comparison function
function compareVersions(version1: string, version2: string): number {
  const v1Parts = version1.split('.').map(Number)
  const v2Parts = version2.split('.').map(Number)
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0
    const v2Part = v2Parts[i] || 0
    
    if (v1Part > v2Part) return 1
    if (v1Part < v2Part) return -1
  }
  
  return 0
} 