# MCP Slash Commands Setup Guide

This document provides instructions for configuring the MCP slash commands in your Slack app.

## Overview

Three slash commands have been implemented for managing MCP server configurations:

1. `/mcp-list` - List all MCP server configurations
2. `/mcp-enable <server-name>` - Enable a specific MCP server
3. `/mcp-disable <server-name>` - Disable a specific MCP server

## Slack App Configuration

To enable these commands in your Slack workspace, you need to configure them in the Slack App settings:

### 1. Navigate to Slack App Settings

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Select your Gengar Bark app
3. Click on "Slash Commands" in the left sidebar

### 2. Create Each Slash Command

For each command, click "Create New Command" and use the following settings:

#### Command: `/mcp-list`

- **Command**: `/mcp-list`
- **Request URL**: `https://your-domain.com/api/gengar/mcp`
- **Short Description**: `List your MCP server configurations`
- **Usage Hint**: _(leave empty)_
- **Escape channels, users, and links sent to your app**: ✅ (checked)

#### Command: `/mcp-enable`

- **Command**: `/mcp-enable`
- **Request URL**: `https://your-domain.com/api/gengar/mcp`
- **Short Description**: `Enable an MCP server`
- **Usage Hint**: `<server-name>`
- **Escape channels, users, and links sent to your app**: ✅ (checked)

#### Command: `/mcp-disable`

- **Command**: `/mcp-disable`
- **Request URL**: `https://your-domain.com/api/gengar/mcp`
- **Short Description**: `Disable an MCP server`
- **Usage Hint**: `<server-name>`
- **Escape channels, users, and links sent to your app**: ✅ (checked)

### 3. Save and Reinstall

After creating all three commands:

1. Click "Save Changes"
2. Reinstall the app to your workspace if prompted

## Usage Examples

### List all MCP servers

```
/mcp-list
```

**Response:**
```
📋 Your MCP Servers

1. GitHub
   Status: ✅ Enabled
   Verification: 🔒 verified
   Transport: SSE
   URL: https://api.github.com/mcp

2. Linear
   Status: ⏸️ Disabled
   Verification: 🔒 verified
   Transport: SSE
   URL: https://api.linear.app/mcp

Use `/mcp-enable <server-name>` or `/mcp-disable <server-name>` to toggle servers.
Visit the App Home tab to add, edit, or delete servers.
```

### Enable an MCP server

```
/mcp-enable GitHub
```

**Response:**
```
✅ Successfully enabled MCP server 'GitHub'.

It will now be used in your AI conversations.
```

### Disable an MCP server

```
/mcp-disable Linear
```

**Response:**
```
⏸️ Successfully disabled MCP server 'Linear'.

It will no longer be used in your AI conversations.
```

## Error Handling

The commands include comprehensive error handling:

- **Missing server name**: Displays usage instructions
- **Server not found**: Suggests using `/mcp-list` to see available servers
- **Already enabled/disabled**: Informs user of current state
- **Service errors**: Displays descriptive error messages

## Implementation Details

### File Structure

```
pages/api/gengar/mcp.ts          # API route handler (routes to specific handlers)
lib/slash-handlers/
  ├── mcp-list.ts                # /mcp-list handler
  ├── mcp-enable.ts              # /mcp-enable handler
  └── mcp-disable.ts             # /mcp-disable handler
```

### Request Flow

1. Slack sends POST request to `/api/gengar/mcp`
2. Request signature is verified
3. Command is routed to appropriate handler based on `command` field
4. Handler interacts with `MCPConfigurationService`
5. Response is sent back to Slack (ephemeral message to user)

### Security

- All requests are verified using Slack signature verification
- User ID is extracted from the request and used for authorization
- Users can only access their own MCP configurations

## Testing

To test the commands locally:

1. Use ngrok or similar tool to expose your local server:
   ```bash
   ngrok http 3000
   ```

2. Update the Request URL in Slack App settings to your ngrok URL:
   ```
   https://your-ngrok-url.ngrok.io/api/gengar/mcp
   ```

3. Test each command in your Slack workspace

## Troubleshooting

### Command not appearing in Slack

- Ensure the app is reinstalled after adding commands
- Check that the app has the `commands` scope

### "Slack signature mismatch" error

- Verify `SLACK_SIGNING_SECRET` environment variable is correct
- Check that the request is coming from Slack

### "Server not found" error

- Verify the server name matches exactly (case-insensitive)
- Use `/mcp-list` to see the exact server names

### Service errors

- Check server logs for detailed error messages
- Verify database connection is working
- Ensure `MCP_ENCRYPTION_KEY` is set in environment variables

## Related Documentation

- [MCP Configuration Design Document](../../.kiro/specs/user-mcp-configuration/design.md)
- [MCP Configuration Requirements](../../.kiro/specs/user-mcp-configuration/requirements.md)
- [MCP App Home Setup](./APP_HOME_SETUP.md)
