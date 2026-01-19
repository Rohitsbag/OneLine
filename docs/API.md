# OneLine API Documentation

## Overview

The OneLine API provides programmatic access to your journal entries. You can use it to:
- Read and write journal entries
- Search across your journal
- Connect AI agents via MCP (Model Context Protocol)

## Authentication

All API requests require authentication using an API key.

### Key Format
```
Authorization: Bearer oline_<key_id>.<secret>
```

### Creating an API Key
1. Open OneLine → Settings
2. Scroll to "API Access" section
3. Click "New Key"
4. Enter a name and select permissions
5. **Copy the secret immediately** - it's only shown once!

### Scopes
| Scope | Description |
|-------|-------------|
| `read:entries` | Read journal entries and search |
| `write:entries` | Create and update entries |
| `read:insights` | Access AI-generated summaries |

---

## REST API v1

### Base URL
```
https://<your-supabase-project>.supabase.co/functions/v1/api-gateway
```

---

### GET /v1/entries

Retrieve journal entries within a date range.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start_date` | string | No | Start date (YYYY-MM-DD). Default: 30 days ago |
| `end_date` | string | No | End date (YYYY-MM-DD). Default: today |
| `limit` | number | No | Max entries to return (1-100). Default: 30 |

**Example:**
```bash
curl -X GET \
  "https://yourproject.supabase.co/functions/v1/api-gateway/v1/entries?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer oline_abc123.secret456"
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "date": "2024-01-15",
      "content": "Today I learned about APIs...",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "has_more": false
  }
}
```

---

### POST /v1/entries

Create or update a journal entry for a specific date.

**Request Body:**
```json
{
  "date": "2024-01-15",
  "content": "My journal entry content..."
}
```

**Limits:**
- Content max size: 100KB
- XSS content is automatically stripped

**Example:**
```bash
curl -X POST \
  "https://yourproject.supabase.co/functions/v1/api-gateway/v1/entries" \
  -H "Authorization: Bearer oline_abc123.secret456" \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15", "content": "Hello from the API!"}'
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "date": "2024-01-15",
    "content": "Hello from the API!",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### GET /v1/search

Search journal entries using full-text search.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `limit` | number | No | Max results (1-10). Default: 10 |

**Example:**
```bash
curl -X GET \
  "https://yourproject.supabase.co/functions/v1/api-gateway/v1/search?q=vacation" \
  -H "Authorization: Bearer oline_abc123.secret456"
```

**Response:**
```json
{
  "data": [
    {
      "date": "2024-07-15",
      "content": "Planning a vacation to...",
      "score": 0.85
    }
  ]
}
```

---

## MCP Server (for AI Agents)

Connect AI assistants like Claude Desktop or custom agents via MCP over SSE.

### Endpoint
```
https://<your-supabase-project>.supabase.co/functions/v1/mcp-server/sse
```

### Available Tools

| Tool | Risk | Description |
|------|------|-------------|
| `search_journal` | Low | Full-text search across entries |
| `get_entry` | Low | Get a specific entry by date |
| `append_entry` | High | Append content to an entry (max 5KB) |
| `summarize_period` | Medium | Get entries for a date range (max 30 days) |

### Claude Desktop Configuration

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "oneline-journal": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://yourproject.supabase.co/functions/v1/mcp-server/sse"],
      "env": {
        "AUTHORIZATION": "Bearer oline_abc123.secret456"
      }
    }
  }
}
```

### Session Limits
- **Max tool calls per session:** 20
- **Session timeout:** 5 minutes
- **Heartbeat interval:** 30 seconds

---

## Error Responses

All errors follow RFC 7807 Problem Details format:

```json
{
  "type": "https://api.oneline.app/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Invalid API key",
  "trace_id": "abc-123-def"
}
```

### Error Codes
| Status | Type | Description |
|--------|------|-------------|
| 400 | bad-request | Invalid request parameters |
| 401 | unauthorized | Invalid or missing API key |
| 403 | forbidden | Missing required scope |
| 404 | not-found | Endpoint not found |
| 429 | rate-limited | Too many requests |
| 500 | internal | Server error |

---

## Rate Limits

- **Writes:** 60 requests/minute per key
- **Reads:** 120 requests/minute per key

When rate limited, you'll receive a `429` response with a `Retry-After` header.

---

## Security Best Practices

1. **Never share your API secret** - treat it like a password
2. **Use minimal scopes** - only request what you need
3. **Rotate keys regularly** - revoke and create new keys periodically
4. **Monitor usage** - check the audit log for unusual activity
