# Google Search Indexing API Cron Job Setup Guide

This guide explains how to set up a daily cron job on your Linux VPS (Virtual Private Server) to automatically process pending website URLs and submit them to the Google Search Index.

---

## 1. How the Bulk Indexing Cron Works
1. **Trigger**: The cron job triggers the secure Next.js API endpoint `/api/indexing-cron` once a day.
2. **Evaluation**: The server checks if the **VPS Cron Active** switch is toggled **ON** in the Admin panel.
3. **Chunk Submission**: It grabs pending URLs (up to 180 entries a day, leaving a 20-request buffer for real-time edits) and submits them to Google.
4. **Auto-Shutdown**: Once all pending pages are indexed (Balance Pending reaches 0), the API automatically toggles the **VPS Cron Active** switch **OFF** to conserve your quota.

---

## 2. Prerequisites

### A. Environment Variable
Make sure you have a `CRON_SECRET` defined in your environment variables on the VPS (usually in your `.env.production` file or PM2 config).
Example:
```env
CRON_SECRET=MySuperSecretCronPass123!
```

### B. Google Indexing API Enabled
Verify that the Web Search Indexing API is enabled on your Google Cloud Console for project `770226362216`. If not, visit:
[Google Developer Console API Activation](https://console.developers.google.com/apis/api/indexing.googleapis.com/overview?project=770226362216)

---

## 3. Step-by-Step VPS Setup

### Step 1: Connect to your VPS
Log into your server via SSH:
```bash
ssh username@your-vps-ip
```

### Step 2: Open the Crontab Editor
Open the system crontab scheduler for your user:
```bash
crontab -e
```
*(If prompted to choose an editor, select `nano` by typing its corresponding number and pressing Enter).*

### Step 3: Add the Indexing Cron Task
Scroll to the bottom of the crontab file and append the following line:
```cron
0 0 * * * curl -s -f -X GET "https://screenplaypro.in/api/indexing-cron?secret=screenplaypro123" > /dev/null 2>&1
```

> [!IMPORTANT]
> Replace `YOUR_CRON_SECRET` with the actual value of your `CRON_SECRET` environment variable.

#### Cron Parameters Explained:
* `0 0 * * *`: Runs the script every day at **midnight (00:00)** server local time.
* `curl -s -f -X GET`: Performs a silent HTTP GET request.
* `> /dev/null 2>&1`: Silences console outputs and email alerts on the server to prevent logs from clogging disk space.

### Step 4: Save and Exit
* In **nano**: Press `CTRL + O`, then `Enter` to save. Press `CTRL + X` to exit.

### Step 5: Verify the Cron Task
Run the list command to ensure your cron task is active and registered:
```bash
crontab -l
```
You should see your new curl task listed at the bottom of the output.

---

## 4. How to Test the Job Manually

You can test if the endpoint works without waiting for midnight:

### Via Browser
Visit the following URL in your web browser:
```
https://screenplaypro.in/api/indexing-cron?secret=screenplaypro123
```

### Via Terminal
Or run a test command directly in your command line:
```bash
curl -i -X GET "https://screenplaypro.in/api/indexing-cron?secret=screenplaypro123"
```

If successful, you will receive a JSON response showing:
```json
{
  "success": true,
  "message": "Processed X out of Y URLs successfully.",
  "submitted": X,
  "remaining": Z
}
```
You can then open the **Google Indexing Dashboard** in the Admin panel to see the **Indexing Progress** update and watch the new logs load under the **Recent Submissions** log table.
