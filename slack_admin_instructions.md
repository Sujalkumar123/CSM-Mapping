# Slack Admin Instructions: App Approving & Token Generation

If you need to guide your Slack Administrator to approve your app or generate a token, you can share these instructions.

---

## Option A: Approve the Pending Request (Easiest & Recommended)
Because sujal.kumar has already submitted the workspace installation request for **"CSM mapping"**, the Administrator has a notification waiting for them. Tell them to do one of the following:

1. **Check Slack Notifications**:
   * The administrator should have received a direct message in Slack from **Slackbot** or **App Requests** saying:
     > *"sujal.kumar has requested to install CSM mapping on FieldAssist."*
   * Click the **Approve** button inside that Slack message.

2. **Check the Admin App Requests Page**:
   * Go to: [https://fieldassist.slack.com/apps/manage/requests](https://fieldassist.slack.com/apps/manage/requests)
   * Find **CSM mapping** under pending requests.
   * Click **Approve**.

---

## Option B: Administrator Generates a Token from Scratch
If the admin prefers to create the app and generate the token themselves, they should follow these steps:

1. **Create the App**:
   * Go to the [Slack App Dashboard](https://api.slack.com/apps).
   * Click **Create New App** -> Select **From scratch**.
   * App Name: `CSM mapping`
   * Development Slack Workspace: Select **FieldAssist**.
   * Click **Create App**.

2. **Add Scopes (Permissions)**:
   * Go to **OAuth & Permissions** in the left sidebar.
   * Scroll down to the **Scopes** section.
   * Under **Bot Token Scopes**, click **Add an OAuth Scope** and add:
     * `users:read`
     * `users:read.email`
     * `im:write`
   * Under **User Token Scopes**, click **Add an OAuth Scope** and add:
     * `users:read`
     * `users:read.email`

3. **Install and Copy Token**:
   * Scroll back to the top of the **OAuth & Permissions** page.
   * Click **Install to Workspace** (this will install it directly since they are the admin).
   * Copy the **Bot User OAuth Token** (starts with `xoxb-`) and share it.
