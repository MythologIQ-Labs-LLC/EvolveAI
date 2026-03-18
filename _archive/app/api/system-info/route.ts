import { NextRequest, NextResponse } from 'next/server'
import os from 'os'

export async function GET(request: NextRequest) {
  try {
    const systemInfo = {
      os: `${os.platform()} ${os.release()}`,
      nodeVersion: process.version,
      electronVersion: process.versions.electron || 'N/A',
      appVersion: '1.0.0', // This should come from package.json
      architecture: os.arch(),
      totalMemory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`,
      freeMemory: `${Math.round(os.freemem() / (1024 * 1024 * 1024))}GB`,
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      cpuCores: os.cpus().length,
      userAgent: request.headers.get('user-agent') || 'Unknown'
    }

    return NextResponse.json(systemInfo)
  } catch (error) {
    console.error('Error getting system info:', error)
    return NextResponse.json(
      { error: 'Failed to get system information' },
      { status: 500 }
    )
  }
} 