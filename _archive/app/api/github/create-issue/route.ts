import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, body: issueBody, labels } = body

    // GitHub API configuration
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN
    const GITHUB_OWNER = 'WulfForge'
    const GITHUB_REPO = 'EvolveAI'

    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      )
    }

    // Create issue via GitHub API
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body: issueBody,
          labels: labels || ['user-reported'],
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('GitHub API error:', error)
      return NextResponse.json(
        { error: 'Failed to create GitHub issue' },
        { status: response.status }
      )
    }

    const issue = await response.json()
    
    return NextResponse.json({
      success: true,
      html_url: issue.html_url,
      number: issue.number,
      title: issue.title
    })

  } catch (error) {
    console.error('Error creating GitHub issue:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 