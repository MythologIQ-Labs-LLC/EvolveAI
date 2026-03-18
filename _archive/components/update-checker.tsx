'use client';

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  ExternalLink,
  X
} from 'lucide-react';

interface UpdateInfo {
  version: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: Array<{
    name: string;
    download_url: string;
    size: number;
  }>;
}

interface UpdateCheckerProps {
  currentVersion: string;
  onUpdateAvailable?: (update: UpdateInfo) => void;
  onUpdateDownloaded?: () => void;
  autoCheck?: boolean;
  checkInterval?: number; // in minutes
}

export default function UpdateChecker({
  currentVersion,
  onUpdateAvailable,
  onUpdateDownloaded,
  autoCheck = true,
  checkInterval = 60
}: UpdateCheckerProps) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showNotification, setShowNotification] = useState(false);

  const GITHUB_REPO = 'WulfForge/EvolveAI';
  const GITHUB_API_BASE = 'https://api.github.com';

  useEffect(() => {
    if (autoCheck) {
      checkForUpdates();
      
      // Set up automatic checking
      const interval = setInterval(() => {
        checkForUpdates();
      }, checkInterval * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [autoCheck, checkInterval]);

  const checkForUpdates = async () => {
    setIsChecking(true);
    setError(null);

    try {
      // Try to use Electron API first
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.checkForUpdates();
        setLastChecked(new Date());
        return;
      }

      // Fallback to GitHub API
      const response = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/latest`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch latest release');
      }

      const release = await response.json();
      const latestVersion = release.tag_name.replace('v', '');
      const current = currentVersion.replace('v', '');

      if (compareVersions(latestVersion, current) > 0) {
        const update: UpdateInfo = {
          version: latestVersion,
          name: release.name,
          body: release.body,
          published_at: release.published_at,
          html_url: release.html_url,
          assets: release.assets
        };

        setUpdateInfo(update);
        setShowNotification(true);
        onUpdateAvailable?.(update);
      }

      setLastChecked(new Date());
    } catch (error) {
      console.error('Error checking for updates:', error);
      setError('Failed to check for updates. Please check your internet connection.');
    } finally {
      setIsChecking(false);
    }
  };

  const compareVersions = (version1: string, version2: string): number => {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  };

  const downloadUpdate = async () => {
    if (!updateInfo) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // Try to use Electron API for automatic download
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Electron handles the download automatically
        setDownloadProgress(100);
        onUpdateDownloaded?.();
        return;
      }

      // Fallback: redirect to GitHub releases
      window.open(updateInfo.html_url, '_blank');
    } catch (error) {
      console.error('Error downloading update:', error);
      setError('Failed to download update. Please download manually from GitHub.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const dismissNotification = () => {
    setShowNotification(false);
  };

  return (
    <>
      {/* Update Notification */}
      {showNotification && updateInfo && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <div className="bg-white rounded-lg shadow-lg border border-green-200 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <Download className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">
                    Update Available
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Version {updateInfo.version} is now available
                  </p>
                  <div className="mt-3 flex space-x-2">
                    <button
                      onClick={downloadUpdate}
                      disabled={isDownloading}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDownloading ? 'Downloading...' : 'Download'}
                    </button>
                    <button
                      onClick={() => window.open(updateInfo.html_url, '_blank')}
                      className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200"
                    >
                      View Release
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={dismissNotification}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Checker Component */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <RefreshCw className={`h-6 w-6 ${isChecking ? 'animate-spin' : ''} text-blue-600`} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Update Checker</h3>
              <p className="text-sm text-gray-600">
                Current version: v{currentVersion}
              </p>
            </div>
          </div>
          <button
            onClick={checkForUpdates}
            disabled={isChecking}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isChecking ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        {/* Status */}
        <div className="space-y-4">
          {/* Last Check */}
          {lastChecked && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>Last checked: {lastChecked.toLocaleString()}</span>
            </div>
          )}

          {/* Update Available */}
          {updateInfo && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-green-900">
                    Update Available - v{updateInfo.version}
                  </h4>
                  <p className="text-sm text-green-700 mt-1">
                    {updateInfo.name}
                  </p>
                  <p className="text-sm text-green-600 mt-2">
                    Released {formatDate(updateInfo.published_at)}
                  </p>
                  
                  {/* Release Notes */}
                  {updateInfo.body && (
                    <div className="mt-3">
                      <details className="text-sm">
                        <summary className="cursor-pointer text-green-700 hover:text-green-800 font-medium">
                          View Release Notes
                        </summary>
                        <div className="mt-2 text-green-700 prose prose-sm max-w-none">
                          <div 
                            dangerouslySetInnerHTML={{ 
                              __html: updateInfo.body.replace(/\n/g, '<br>') 
                            }}
                          />
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Download Options */}
                  <div className="mt-4 space-y-2">
                    <button
                      onClick={downloadUpdate}
                      disabled={isDownloading}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isDownloading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Downloading... {downloadProgress}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center space-x-2">
                          <Download className="h-4 w-4" />
                          <span>Download Update</span>
                        </div>
                      )}
                    </button>
                    
                    <button
                      onClick={() => window.open(updateInfo.html_url, '_blank')}
                      className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <ExternalLink className="h-4 w-4" />
                        <span>View on GitHub</span>
                      </div>
                    </button>
                  </div>

                  {/* Download Assets */}
                  {updateInfo.assets.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium text-green-900 mb-2">Download Options:</h5>
                      <div className="space-y-2">
                        {updateInfo.assets.map((asset) => (
                          <div key={asset.name} className="flex items-center justify-between bg-white p-3 rounded border">
                            <div className="flex items-center space-x-3">
                              <Download className="h-4 w-4 text-green-600" />
                              <div>
                                <div className="font-medium text-gray-900">{asset.name}</div>
                                <div className="text-sm text-gray-600">{formatFileSize(asset.size)}</div>
                              </div>
                            </div>
                            <a
                              href={asset.download_url}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Download
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* No Update Available */}
          {!updateInfo && !isChecking && lastChecked && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <div>
                  <h4 className="font-medium text-blue-900">Up to Date</h4>
                  <p className="text-sm text-blue-700">
                    You're running the latest version of EvolveAI
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <h4 className="font-medium text-red-900">Update Check Failed</h4>
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={checkForUpdates}
                    className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Auto-check Settings */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Automatic Updates</h4>
                <p className="text-sm text-gray-600">
                  Check for updates every {checkInterval} minutes
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoCheck"
                  checked={autoCheck}
                  onChange={(e) => {
                    // This would typically be controlled by parent component
                    console.log('Auto-check toggled:', e.target.checked);
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="autoCheck" className="text-sm text-gray-700">
                  Enable
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 