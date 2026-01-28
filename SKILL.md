# Footprint Agent Skill

> MCP server for capturing and encrypting AI conversations as verifiable records with Git timestamps.

**Package:** `@pcircle/footprint` (v1.1.1)  
**Protocol:** Model Context Protocol (MCP)  
**License:** MIT

## Decision Tree: Should I Capture This?

```
Should I capture this conversation?
├─ User explicitly asked → YES
│   ├─ "save this conversation"
│   ├─ "record this for evidence"  
│   ├─ "capture this as evidence"
│   └─ "I need this for legal/audit purposes"
├─ High-value content mentioned → SUGGEST to user
│   ├─ IP/Patents: "patent", "intellectual property", "IP", "invention"
│   ├─ Legal: "contract", "agreement", "legal", "copyright", "license"
│   ├─ Business: "decision", "milestone", "deliverable", "approval"
│   ├─ Research: "algorithm", "research hypothesis", "findings", "proof"
│   └─ Compliance: "audit", "compliance", "evidence", "documentation"
├─ Casual chat/small talk → NO
│   ├─ Weather, personal life, jokes
│   ├─ Basic troubleshooting
│   └─ Draft/brainstorming sessions (unless finalized)
└─ Uncertain content → ASK user
    └─ "Would you like me to save this conversation as evidence?"
```

## Specific Trigger Patterns

**Immediate capture (don't ask, just do it):**
- "save this conversation"
- "record this for evidence" 
- "capture this as evidence"
- "I need this documented"
- "save this for legal purposes"

**Suggest capture (ask user first):**
- After discussing: patents, contracts, algorithms, research hypotheses, business decisions
- When mentioned: "IP", "copyright", "legal", "audit", "proof", "compliance"
- Milestone completions: "finished", "completed", "approved", "signed off"
- Key decisions: "we decided", "the plan is", "going with option"

**Never capture without explicit request:**
- Casual conversations, personal chat, jokes
- Debugging sessions, draft work, brainstorming
- Test conversations, API experiments
- Private/sensitive personal information

## Available Tools

### 1. `capture-footprint`
Save a conversation as encrypted evidence.

**Input Parameters:**
```json
{
  "conversationId": "api-auth-decision-2026-01-28",
  "llmProvider": "Claude Sonnet 4.5", 
  "content": "Human: We need to decide on the OAuth implementation...\nAssistant: I recommend using PKCE flow...\nHuman: Approved, let's go with that approach.",
  "messageCount": 15,
  "tags": "api,oauth,security,decision,approved"
}
```

**Expected Output (text):**
```
✅ Evidence captured successfully
- Evidence ID: `550e8400-e29b-41d4-a716-446655440000`
- Conversation ID: `api-auth-decision-2026-01-28`
- Messages: 15 
- Tags: api,oauth,security,decision,approved
- Git hash: `a1b2c3d4e5f6789...`
- Created: 2026-01-28T14:30:45Z

Keep this Evidence ID safe for future reference.
```

**Expected Output (structuredContent):**
```json
{
  "type": "evidence_created",
  "evidenceId": "550e8400-e29b-41d4-a716-446655440000",
  "conversationId": "api-auth-decision-2026-01-28", 
  "messageCount": 15,
  "tags": ["api", "oauth", "security", "decision", "approved"],
  "gitHash": "a1b2c3d4e5f6789...",
  "timestamp": "2026-01-28T14:30:45Z",
  "verified": true
}
```

### 2. `list-footprints`
List all captured evidence (metadata only).

**Input Parameters:**
```json
{
  "limit": 10,
  "offset": 0
}
```

**Expected Output (text):**
```
📋 Evidence Archive (10 most recent)
1. api-auth-decision-2026-01-28 | 15 msgs | api,oauth,security
2. patent-algorithm-2026-01-27 | 32 msgs | ip,patent,algorithm  
3. contract-review-2026-01-26 | 8 msgs | legal,contract
...
```

**Expected Output (structuredContent):**
```json
{
  "type": "evidence_list",
  "total": 25,
  "evidences": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "conversationId": "api-auth-decision-2026-01-28",
      "messageCount": 15,
      "tags": ["api", "oauth", "security"],
      "created": "2026-01-28T14:30:45Z"
    }
  ]
}
```

### 3. `get-footprint`
Retrieve and decrypt specific evidence.

**Input Parameters:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Expected Output (text):**
```
📄 Evidence Retrieved
- ID: 550e8400-e29b-41d4-a716-446655440000
- Created: 2026-01-28T14:30:45Z
- Provider: Claude Sonnet 4.5
- Verified: ✅ Checksum valid, Git timestamp confirmed

[Decrypted conversation content follows...]
Human: We need to decide on the OAuth implementation...
Assistant: I recommend using PKCE flow...
```

### 4. `search-footprints`
Find evidence by content or tags.

**Input Parameters:**
```json
{
  "query": "OAuth OR PKCE OR authentication",
  "tags": ["api", "security"],
  "limit": 5
}
```

### 5. `export-footprints`
Export evidence as encrypted archive.

**Input Parameters:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "format": "zip"
}
```

**Expected Output (structuredContent):**
```json
{
  "type": "evidence_export",
  "filename": "evidence-550e8400-export.zip",
  "base64Data": "UEsDBBQAAAAIAL...",
  "size": 2048,
  "checksum": "sha256:a1b2c3d4..."
}
```

### 6. `verify-footprint`
Verify evidence integrity (checksum + Git timestamp).

**Input Parameters:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Expected Output (text):**
```
🔐 Evidence Verification Report
- ID: 550e8400-e29b-41d4-a716-446655440000
- Content Hash: ✅ Valid (SHA-256 matches)
- Git Timestamp: ✅ Verified (2026-01-28T14:30:45Z)
- Encryption: ✅ Decryption successful
- Status: AUTHENTIC - No tampering detected
```

**Expected Output (structuredContent):**
```json
{
  "type": "verification_result",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "contentHashValid": true,
  "gitTimestampVerified": true,
  "decryptionSuccessful": true,
  "status": "authentic",
  "timestamp": "2026-01-28T14:30:45Z"
}
```

## Best Practices

### Naming conversationId
**Format:** `{topic-type}-{descriptive-name}-{YYYY-MM-DD}`

**Good examples:**
- `api-auth-decision-2026-01-28`
- `patent-ml-algorithm-2026-01-27`
- `contract-vendor-negotiation-2026-01-26`
- `milestone-mvp-completion-2026-01-25`

**Avoid:**
- `conversation-1` (not descriptive)
- `important-chat` (too vague)  
- `chat-2026-01-28` (missing context)

### Choosing Tags
**Common patterns:**
- **Type**: `decision`, `milestone`, `research`, `review`, `approval`
- **Domain**: `api`, `ui`, `database`, `security`, `legal`, `business`
- **Status**: `draft`, `finalized`, `approved`, `rejected`
- **IP**: `patent`, `copyright`, `trade-secret`, `invention`
- **Legal**: `contract`, `agreement`, `compliance`, `audit`

**Tag Guidelines:**
- Use 3-6 tags maximum
- Prefer specific over general (`oauth` not just `auth`)
- Include project/product names if relevant
- Always include content type (`decision`, `research`, etc.)

### When to Use Each Tool
- **capture-footprint**: Primary tool for saving conversations
- **list-footprints**: Browse/overview existing evidence
- **search-footprints**: Find specific content across evidence
- **get-footprint**: Retrieve full content of specific evidence
- **export-footprints**: Legal/audit export needs
- **verify-footprint**: Verify evidence integrity and checksums

## Token-Efficient Agent Responses

**After capturing evidence (keep it brief):**
```
✅ Evidence saved as `{conversationId}` 
ID: `{first-8-chars-of-id}`...
Tags: {tags}
```

**When suggesting capture:**
```
💡 This looks like valuable evidence (contains {trigger}). Save it?
```

**When declining to capture:**
```
ℹ️ Skipping evidence capture (casual conversation)
```

**For retrieval:**
```
📄 Found: {conversationId} ({messageCount} messages)
[Show relevant excerpt or summary]
```

## Error Handling with Recovery Actions

| Error | Likely Cause | Recovery Action |
|-------|--------------|-----------------|
| "Password required" | FOOTPRINT_PASSWORD not set | 1. Check env config<br>2. Restart MCP server<br>3. Verify password in env |
| "Evidence not found" | Invalid/wrong ID | 1. Use `list-footprints` to find correct ID<br>2. Search by conversationId<br>3. Check if user meant different evidence |
| "Decryption failed" | Password changed/wrong | 1. Verify current password matches<br>2. Check if evidence pre-dates password change<br>3. Try with backup password if available |
| "Database error" | DB path/permissions issues | 1. Check FOOTPRINT_DB_PATH exists<br>2. Verify file permissions<br>3. Create directory if missing |
| "Git repository error" | Git not initialized | 1. Initialize git in evidence directory<br>2. Set git user.name/user.email<br>3. Make initial commit |
| "Capture timeout" | Large conversation size | 1. Split into smaller chunks<br>2. Reduce messageCount<br>3. Compress content before capture |

**Agent Recovery Protocol:**
1. **Detect error** from tool response
2. **Identify cause** from error message
3. **Apply recovery action** from table above  
4. **Retry operation** if recovery successful
5. **Escalate to user** only if recovery fails

## Workflow Examples

### 1. User Explicit Request
```
User: "Save this conversation about the API design"

Agent:
1. ✅ Capture immediately (explicit request)
2. Use conversationId: "api-design-discussion-2026-01-28"
3. Tags: "api,design,architecture"
4. Report success with Evidence ID
```

### 2. High-Value Content Detection  
```
User: "We've decided to patent this algorithm approach."

Agent:
1. 🔍 Detect trigger: "patent" + "decided"
2. 💡 Suggest: "This looks like valuable evidence (contains patent decision). Save it?"
3. ✅ If user agrees, capture with tags: "patent,algorithm,decision,ip"
```

### 3. Evidence Retrieval
```
User: "Find the conversation about OAuth implementation"

Agent:
1. 🔍 Search: list-footprints or search-evidence with "OAuth"
2. 📄 Present matches with conversationId and brief summary
3. 🎯 If user selects one, get-footprint to show full content
```

### 4. Legal Export
```
User: "Export the patent evidence for filing"

Agent: 
1. 🔍 Help identify relevant evidence (search by "patent" tag)
2. 📦 Export each evidence as encrypted ZIP
3. ✅ Provide files with verification instructions
4. 📋 Remind about Git hash verification for legal proof
```

## Security & Verification

- **Password**: Set via `FOOTPRINT_PASSWORD` env var (never ask user in chat)
- **Encryption**: XChaCha20-Poly1305 (256-bit) with Argon2id key derivation  
- **Git Timestamps**: Cryptographic proof of creation time
- **SHA-256 Checksums**: Detect any content tampering
- **Evidence Chain**: Each capture creates immutable Git commit
- **Storage**: Local SQLite with encrypted BLOBs (no cloud, no tracking)

**For legal proceedings:**
1. Export evidence with `export-evidence` 
2. Verify Git hash against repository
3. Check SHA-256 checksum matches
4. Git log shows creation timestamp
5. Encrypted archive proves content integrity

## Installation (Reference Only)

This section is for humans setting up the agent environment:

```bash
# Install MCP server globally
npm install -g @pcircle/footprint

# Or run directly with npx
npx @pcircle/footprint
```

**Claude Desktop config location:**

| Platform | Config Path |
|----------|-------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

**Config content:**
```json
{
  "mcpServers": {
    "footprint": {
      "command": "npx",
      "args": ["@pcircle/footprint"],
      "env": {
        "FOOTPRINT_DB_PATH": "/path/to/evidence.db",
        "FOOTPRINT_PASSWORD": "your-secure-password-here"
      }
    }
  }
}
```

**Environment Variables:**
- `FOOTPRINT_PASSWORD` (required): Encryption passphrase
- `FOOTPRINT_DB_PATH` (optional): Path to SQLite database (default: `./evidence.db` in current directory)

## Performance Notes

- **Capture time**: ~1-3 seconds per conversation
- **Database size**: ~1KB per message on average
- **Git overhead**: ~100 bytes per evidence commit
- **Search speed**: Sub-second for <1000 evidence records
- **Export time**: ~5-15 seconds depending on content size

Large conversations (>100 messages) may take longer to encrypt and commit.