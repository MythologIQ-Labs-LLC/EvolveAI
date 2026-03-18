# Google AI Studio Setup Guide for EvolveAI

## Overview

EvolveAI uses Google AI Studio (formerly Google Gemini) to provide powerful AI conversation capabilities. Google AI Studio is completely free and offers excellent performance for AI interactions.

## Getting Your API Key

### Step 1: Visit Google AI Studio
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. If you don't have a Google account, create one for free

### Step 2: Create API Key
1. In Google AI Studio, click on "Get API key" or "Create API key"
2. Choose "Create API key in new project" or select an existing project
3. Give your project a name (e.g., "EvolveAI")
4. Click "Create API key"

### Step 3: Copy Your API Key
1. Your API key will be displayed (it starts with "AI")
2. Copy the entire key
3. **Important**: Keep this key secure and don't share it publicly

## API Key Format
- Google AI Studio API keys typically start with "AI"
- They are usually 39 characters long
- Example format: `AIzaSyC...` (truncated for security)

## Setting Up in EvolveAI

### Method 1: Through the Chat Interface
1. Start EvolveAI
2. Go to the Chat interface
3. Select "Gemini" as your chat mode
4. Enter your API key in the "Google AI Studio API Key" field
5. Click "Test Connection" to verify it works
6. Start chatting!

### Method 2: Using the Test Script
1. Start the EvolveAI development server: `npm run dev`
2. Run the test script: `.\test-ai-studio.bat`
3. Enter your API key when prompted
4. The script will verify your connection

### Method 3: Environment Variable (Advanced)
1. Create a `.env.local` file in your EvolveAI directory
2. Add: `AI_STUDIO_API_KEY=your_api_key_here`
3. Restart the application

## Troubleshooting

### Common Issues

#### "Invalid API key" Error
- **Cause**: Incorrect API key format or invalid key
- **Solution**: 
  - Double-check your API key
  - Make sure it starts with "AI"
  - Copy the entire key without extra spaces

#### "API quota exceeded" Error
- **Cause**: You've reached the free tier limits
- **Solution**:
  - Google AI Studio free tier: 60 requests/minute
  - Wait a minute and try again
  - Consider upgrading to a paid plan if needed

#### "Service temporarily unavailable" Error
- **Cause**: Google AI Studio service is experiencing issues
- **Solution**:
  - Wait a few minutes and try again
  - Check [Google AI Studio Status](https://status.aistudio.google.com/)
  - This is usually temporary

#### "Visibility check was unavailable" Error
- **Cause**: Service endpoint issues
- **Solution**:
  - This is a known issue that we've improved handling for
  - The app will automatically retry
  - If persistent, wait a few minutes and try again

### Performance Tips

1. **Use Appropriate Models**:
   - `gemini-1.5-flash`: Fast, good for most conversations
   - `gemini-1.5-pro`: More capable, better for complex tasks
   - `gemini-1.0-pro`: Stable, reliable performance

2. **Optimize Requests**:
   - Keep messages concise
   - Avoid sending very long conversations
   - Use system prompts for context

3. **Monitor Usage**:
   - Check your Google AI Studio dashboard for usage
   - Stay within free tier limits
   - Consider usage patterns

## Security Best Practices

1. **Keep Your API Key Secure**:
   - Don't share it publicly
   - Don't commit it to version control
   - Use environment variables in production

2. **Monitor Usage**:
   - Regularly check your Google AI Studio dashboard
   - Set up usage alerts if available
   - Review API calls for unusual activity

3. **Rotate Keys**:
   - Consider rotating your API key periodically
   - Delete old keys when no longer needed

## Free Tier Limits

- **Requests per minute**: 60
- **Requests per day**: 1,500
- **Models available**: All Gemini models
- **Cost**: Completely free

## Support

If you continue to experience issues:

1. **Check the logs**: Look for detailed error messages in the console
2. **Run diagnostics**: Use `.\diagnose-electron.bat` for system checks
3. **Test API key**: Use `.\test-ai-studio.bat` for API testing
4. **Report issues**: Create an issue on [GitHub](https://github.com/WulfForge/EvolveAI/issues)

## Alternative AI Providers

If Google AI Studio doesn't work for you, EvolveAI also supports:
- Local LLM integration
- Custom API endpoints
- Other AI providers (via custom API manager)

---

**Note**: This guide is for EvolveAI v1.0.0. For the latest information, check the [official documentation](https://github.com/WulfForge/EvolveAI). 