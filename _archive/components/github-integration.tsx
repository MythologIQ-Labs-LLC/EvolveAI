'use client';

import React, { useState, useEffect } from 'react';
import { 
  Github, 
  Bug, 
  Download, 
  BookOpen, 
  MessageCircle, 
  Star,
  GitBranch,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';

interface GitHubRelease {
  id: number;
  tag_name: string;
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

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
}

interface GitHubStats {
  stars: number;
  forks: number;
  issues: number;
  open_issues: number;
}

const GITHUB_REPO = 'WulfForge/EvolveAI';
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

export default function GitHubIntegration() {
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [latestRelease, setLatestRelease] = useState<GitHubRelease | null>(null);
  const [recentIssues, setRecentIssues] = useState<GitHubIssue[]>([]);
  const [stats, setStats] = useState<GitHubStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    getCurrentVersion();
    fetchGitHubData();
  }, []);

  const getCurrentVersion = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const version = await window.electronAPI.getAppVersion();
        setCurrentVersion(version);
      } else {
        setCurrentVersion('1.0.0'); // Fallback for web version
      }
    } catch (error) {
      console.error('Error getting current version:', error);
      setCurrentVersion('1.0.0');
    }
  };

  const fetchGitHubData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch latest release
      const releaseResponse = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/latest`);
      if (releaseResponse.ok) {
        const release = await releaseResponse.json();
        setLatestRelease(release);
        
        // Check if update is available
        if (release.tag_name && currentVersion) {
          const latest = release.tag_name.replace('v', '');
          const current = currentVersion.replace('v', '');
          setUpdateAvailable(compareVersions(latest, current) > 0);
        }
      }

      // Fetch recent issues
      const issuesResponse = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/issues?state=open&per_page=5&sort=updated`);
      if (issuesResponse.ok) {
        const issues = await issuesResponse.json();
        setRecentIssues(issues);
      }

      // Fetch repository stats
      const repoResponse = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}`);
      if (repoResponse.ok) {
        const repo = await repoResponse.json();
        setStats({
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          issues: repo.open_issues_count,
          open_issues: repo.open_issues_count
        });
      }
    } catch (error) {
      console.error('Error fetching GitHub data:', error);
      setError('Failed to fetch GitHub data. Please check your internet connection.');
    } finally {
      setLoading(false);
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

  const openGitHub = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.openGitHub();
    } else {
      window.open(GITHUB_URL, '_blank');
    }
  };

  const openIssues = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.openIssues();
    } else {
      window.open(`${GITHUB_URL}/issues`, '_blank');
    }
  };

  const openReleases = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.openReleases();
    } else {
      window.open(`${GITHUB_URL}/releases`, '_blank');
    }
  };

  const reportIssue = () => {
    const issueUrl = `${GITHUB_URL}/issues/new?template=bug_report.md&title=Bug%20Report%20-%20EvolveAI%20v${currentVersion}`;
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.openIssues();
    } else {
      window.open(issueUrl, '_blank');
    }
  };

  const checkForUpdates = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.checkForUpdates();
      } else {
        // For web version, just refresh GitHub data
        await fetchGitHubData();
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading GitHub data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Github className="h-8 w-8 text-gray-800" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">GitHub Integration</h2>
              <p className="text-gray-600">Connect with the EvolveAI community</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {updateAvailable && (
              <div className="flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-1 rounded-full">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Update Available</span>
              </div>
            )}
            <button
              onClick={checkForUpdates}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Check Updates</span>
            </button>
          </div>
        </div>

        {/* Repository Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.stars}</div>
              <div className="text-sm text-gray-600">Stars</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.forks}</div>
              <div className="text-sm text-gray-600">Forks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.issues}</div>
              <div className="text-sm text-gray-600">Issues</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">v{currentVersion}</div>
              <div className="text-sm text-gray-600">Current</div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={openGitHub}
            className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg transition-colors"
          >
            <Github className="h-5 w-5" />
            <span>Repository</span>
          </button>
          <button
            onClick={openIssues}
            className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg transition-colors"
          >
            <Bug className="h-5 w-5" />
            <span>Issues</span>
          </button>
          <button
            onClick={openReleases}
            className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg transition-colors"
          >
            <Download className="h-5 w-5" />
            <span>Releases</span>
          </button>
          <button
            onClick={reportIssue}
            className="flex items-center justify-center space-x-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-3 rounded-lg transition-colors"
          >
            <AlertCircle className="h-5 w-5" />
            <span>Report Bug</span>
          </button>
        </div>
      </div>

      {/* Latest Release */}
      {latestRelease && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Latest Release</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">v{latestRelease.tag_name.replace('v', '')}</span>
              {updateAvailable && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                  New
                </span>
              )}
            </div>
          </div>
          
          <div className="mb-4">
            <h4 className="font-medium text-gray-900 mb-2">{latestRelease.name}</h4>
            <p className="text-gray-600 text-sm mb-3">
              Released {formatDate(latestRelease.published_at)}
            </p>
            <div className="prose prose-sm max-w-none">
              <div 
                className="text-gray-700 text-sm"
                dangerouslySetInnerHTML={{ 
                  __html: latestRelease.body.replace(/\n/g, '<br>') 
                }}
              />
            </div>
          </div>

          {/* Download Assets */}
          {latestRelease.assets.length > 0 && (
            <div className="border-t pt-4">
              <h5 className="font-medium text-gray-900 mb-3">Downloads</h5>
              <div className="space-y-2">
                {latestRelease.assets.map((asset) => (
                  <div key={asset.name} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Download className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="font-medium text-gray-900">{asset.name}</div>
                        <div className="text-sm text-gray-600">{formatFileSize(asset.size)}</div>
                      </div>
                    </div>
                    <a
                      href={asset.download_url}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
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
      )}

      {/* Recent Issues */}
      {recentIssues.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Issues</h3>
            <button
              onClick={openIssues}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View All
            </button>
          </div>
          
          <div className="space-y-3">
            {recentIssues.map((issue) => (
              <div key={issue.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <img 
                    src={issue.user.avatar_url} 
                    alt={issue.user.login}
                    className="h-8 w-8 rounded-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <a
                      href={issue.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-gray-900 hover:text-blue-600 truncate"
                    >
                      #{issue.number} {issue.title}
                    </a>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      issue.state === 'open' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {issue.state}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                    <span>by {issue.user.login}</span>
                    <span>•</span>
                    <span>{formatDate(issue.updated_at)}</span>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800 font-medium">Error</span>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
          <button
            onClick={fetchGitHubData}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Community Links */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Community & Support</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href={`${GITHUB_URL}/blob/main/README.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <BookOpen className="h-6 w-6 text-blue-600" />
            <div>
              <div className="font-medium text-gray-900">Documentation</div>
              <div className="text-sm text-gray-600">Comprehensive guides and tutorials</div>
            </div>
          </a>
          
          <a
            href={`${GITHUB_URL}/discussions`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MessageCircle className="h-6 w-6 text-green-600" />
            <div>
              <div className="font-medium text-gray-900">Discussions</div>
              <div className="text-sm text-gray-600">Community discussions and Q&A</div>
            </div>
          </a>
          
          <a
            href={`${GITHUB_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bug className="h-6 w-6 text-red-600" />
            <div>
              <div className="font-medium text-gray-900">Bug Reports</div>
              <div className="text-sm text-gray-600">Report issues and request features</div>
            </div>
          </a>
          
          <a
            href={`${GITHUB_URL}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Star className="h-6 w-6 text-yellow-600" />
            <div>
              <div className="font-medium text-gray-900">Star Repository</div>
              <div className="text-sm text-gray-600">Show your support for EvolveAI</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
} 