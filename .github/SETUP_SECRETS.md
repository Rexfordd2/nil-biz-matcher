# GitHub Actions Setup Guide for Vercel Deployment

This guide will help you configure GitHub Secrets required for the Vercel deployment workflows.

## Required Secrets

You need to add the following secrets to your GitHub repository:

### 1. VERCEL_TOKEN
Your Vercel authentication token.

**How to get it:**
1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Give it a descriptive name (e.g., "GitHub Actions")
4. Copy the token immediately (it won't be shown again)

### 2. VERCEL_ORG_ID
Your Vercel organization/team ID.

**How to get it:**
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel link` in your project directory
3. Follow the prompts to link your project
4. Open the generated `.vercel/project.json` file
5. Copy the `orgId` value

Alternatively, run:
```bash
npx vercel whoami --token=YOUR_TOKEN
npx vercel teams ls --token=YOUR_TOKEN
```

### 3. VERCEL_PROJECT_ID
Your Vercel project ID.

**How to get it:**
1. Run: `vercel link` in your project directory (if not already done)
2. Open the generated `.vercel/project.json` file
3. Copy the `projectId` value

Or find it in your Vercel dashboard:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → General
4. Copy the Project ID

## Adding Secrets to GitHub

1. Go to your GitHub repository
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:
   - Name: `VERCEL_TOKEN`, Value: `your-token-here`
   - Name: `VERCEL_ORG_ID`, Value: `your-org-id-here`
   - Name: `VERCEL_PROJECT_ID`, Value: `your-project-id-here`

## Environment Variables (Optional)

If your application requires environment variables (e.g., Supabase keys), add them as GitHub Secrets as well:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- Any other required environment variables

Then reference them in your workflow file under the `env:` section.

## Workflows Included

### 1. `verify-vercel-access.yml`
- **Purpose:** Verify Vercel token and scope access
- **Trigger:** Manual or weekly on Mondays
- **Use case:** Test credentials without deploying

### 2. `deploy-vercel.yml`
- **Purpose:** Full CI/CD pipeline with deployment
- **Trigger:** Push to main/master, pull requests, or manual
- **Features:**
  - Token verification
  - Type checking
  - Tests
  - Preview deployments for PRs
  - Production deployments for main branch

## Testing the Setup

After adding secrets, test the workflows:

1. Go to **Actions** tab in your GitHub repository
2. Select "Verify Vercel Access" workflow
3. Click "Run workflow" → "Run workflow"
4. Check the logs to ensure verification succeeds

## Troubleshooting

### Common Issues

**"Error: No token provided"**
- Make sure `VERCEL_TOKEN` is added to GitHub Secrets
- Check the secret name matches exactly (case-sensitive)

**"Error: Invalid token"**
- Regenerate your Vercel token
- Update the GitHub secret

**"Error: Project not found"**
- Verify `VERCEL_PROJECT_ID` is correct
- Ensure the token has access to the project

**"Error: Insufficient permissions"**
- Check token scope includes deployment permissions
- Verify org/team access with: `npx vercel teams ls --token=YOUR_TOKEN`

## Manual Deployment

You can manually trigger deployments:
1. Go to **Actions** tab
2. Select "Deploy to Vercel" workflow
3. Click "Run workflow"
4. Select the branch
5. Click "Run workflow"

## Security Best Practices

- ✅ Never commit tokens or secrets to your repository
- ✅ Use GitHub Secrets for all sensitive values
- ✅ Rotate tokens periodically
- ✅ Use separate tokens for different purposes
- ✅ Review token permissions regularly
- ✅ The workflows are configured to NOT print secret values in logs
