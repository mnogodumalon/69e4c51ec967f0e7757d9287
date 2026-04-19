"""
Claude Agent for Preview Mode - Makes changes but does NOT auto-deploy.
The user will review changes in live preview before deploying manually.
"""
import asyncio
import json
import time
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AssistantMessage, UserMessage, ToolUseBlock, ToolResultBlock, TextBlock, ResultMessage, HookMatcher, create_sdk_mcp_server, tool
import subprocess
import os

_t0 = time.time()
_LOG_LEVEL = os.getenv("LOG_LEVEL", "warn").lower()

async def _on_post_tool_use(input_data: dict, tool_use_id: str | None = None, context: dict | None = None) -> dict:
    """Log tool results after execution (only at debug level)."""
    if _LOG_LEVEL == "debug":
        try:
            tool_name = input_data.get("tool_name", "?")
            response = input_data.get("tool_response", "")
            output = str(response)[:4000] if response else ""
            elapsed = round(time.time() - _t0, 1)
            print(json.dumps({"type": "tool_result", "tool": tool_name, "output": output, "t": elapsed}), flush=True)
        except Exception as e:
            elapsed = round(time.time() - _t0, 1)
            print(json.dumps({"type": "tool_result", "tool": input_data.get("tool_name", "?"), "output": f"[hook error: {e}]", "t": elapsed}), flush=True)
    return {"continue_": True}


async def main():
    # In preview mode, we provide a dummy deploy tool that just informs the user
    @tool("deploy_to_github",
          "In Preview-Mode nicht verfügbar. Der User wird nach der Live-Preview manuell deployen.",
          {})
    async def deploy_to_github_disabled(args):
        """Disabled in preview mode - inform the agent"""
        return {
            "content": [{
                "type": "text", 
                "text": "⚠️ PREVIEW MODE: Deploy ist deaktiviert. Der User wird die Änderungen erst in der Live-Preview testen und dann manuell deployen. Deine Änderungen sind gespeichert."
            }]
        }

    deployment_server = create_sdk_mcp_server(
        name="deployment",
        version="1.0.0",
        tools=[deploy_to_github_disabled]
    )

    # Preview mode: direct editing only, no subagents/orchestrator

    # Options - LIVE PREVIEW MODE: Accept edits automatically for instant writes!
    options = ClaudeAgentOptions(
        hooks={
            "PostToolUse": [HookMatcher(matcher=None, hooks=[_on_post_tool_use], timeout=60)],
        },
        system_prompt={
            "type": "preset",
            "preset": "claude_code",
            "append": (
                "MANDATORY RULES (highest priority):\n"
                "- No design_brief.md — analyze data in 1-2 sentences, then implement directly\n"
                "- NEVER use Bash for file operations (no cat, echo, heredoc, >, >>). ALWAYS use Read/Write/Edit tools.\n"
                "- index.css: NEVER touch — pre-generated design system. CRUD pages/dialogs: NEVER touch.\n"
                "- App.tsx, PageShell.tsx, StatCard.tsx, ConfirmDialog.tsx, Layout.tsx: NEVER touch\n"
                "- useDashboardData.ts, enriched.ts, enrich.ts, formatters.ts, ai.ts, chat-context.ts, ChatWidget.tsx: NEVER touch\n"
                "- Rules of Hooks: ALL hooks MUST be BEFORE any early returns.\n"
                "- IMPORT HYGIENE: Only import what you actually use.\n"
                "- TOUCH-FRIENDLY: NEVER hide buttons behind hover."
            ),
        },
        setting_sources=["project"],
        mcp_servers={"deploy_tools": deployment_server},
        permission_mode="bypassPermissions",
        disallowed_tools=["TodoWrite", "NotebookEdit", "WebFetch", "ExitPlanMode", "SlashCommand"],
        cwd="/home/user/app",
        model="claude-sonnet-4-6",
    )

    # Session-Resume support
    resume_session_id = os.getenv('RESUME_SESSION_ID')
    if resume_session_id:
        options.resume = resume_session_id
        print(f"[KLAR-PREVIEW] Resuming session: {resume_session_id}")

    # User Prompt - prefer file over env var (handles special chars better)
    user_prompt = None
    
    # First try reading from file (more reliable for special chars)
    prompt_file = "/home/user/app/.user_prompt"
    if os.path.exists(prompt_file):
        try:
            with open(prompt_file, 'r') as f:
                user_prompt = f.read().strip()
            if user_prompt:
                print(f"[KLAR-PREVIEW] Prompt aus Datei gelesen: {len(user_prompt)} Zeichen")
        except Exception as e:
            print(f"[KLAR-PREVIEW] Fehler beim Lesen der Prompt-Datei: {e}")
    
    # Fallback to env var
    if not user_prompt:
        user_prompt = os.getenv('USER_PROMPT')
        if user_prompt:
            print(f"[KLAR-PREVIEW] Prompt aus ENV gelesen")
    
    # Check if user attached an image (data-URI written by the backend)
    import re as _re
    user_image_data = None
    image_file = "/home/user/app/.user_image"
    if os.path.exists(image_file):
        try:
            with open(image_file, 'r') as f:
                raw_uri = f.read().strip()
            m = _re.match(r'^data:([^;]+);base64,(.+)$', raw_uri, _re.DOTALL)
            if m:
                user_image_data = {"media_type": m.group(1), "data": m.group(2)}
                print(f"[KLAR-PREVIEW] Bild geladen: {m.group(1)}, {len(m.group(2))} chars base64")
        except Exception as e:
            print(f"[KLAR-PREVIEW] Fehler beim Lesen der Bild-Datei: {e}")

    if user_prompt:
        # Preview mode prompt - no deploy, incremental edits for live HMR!
        query = f"""🔴 LIVE PREVIEW MODE - Der User sieht deine Änderungen in Echtzeit!

User-Anfrage: "{user_prompt}"

⚡ WICHTIG: Der Vite Dev-Server läuft BEREITS! Der User sieht jede Dateiänderung SOFORT im Browser!

SCHRITTE (arbeite INKREMENTELL für Live-Updates):

1. LESEN: Lies src/pages/DashboardOverview.tsx um die aktuelle Struktur zu verstehen

2. ÄNDERN (SCHRITT FÜR SCHRITT!):
   - Mache EINE Änderung (z.B. Farbe ändern)
   - Die Datei wird sofort geschrieben → User sieht es LIVE! ⚡
   - Mache die NÄCHSTE Änderung
   - Wieder sofort sichtbar!

3. TESTEN: Am Ende 'npm run build' um sicherzustellen dass es kompiliert

⚠️ KRITISCH für Live-Preview:
- Arbeite SCHRITT FÜR SCHRITT, nicht alles auf einmal!
- Jede Dateiänderung = Live-Update im Browser!
- Rufe NICHT deploy_to_github auf!
- Der User testet die Änderungen in der Live-Preview

Das Dashboard existiert bereits. Mache NUR die angeforderten Änderungen.
Starte JETZT!"""
        print(f"[KLAR-PREVIEW] User-Prompt: {user_prompt}")
    else:
        # Initial build in preview mode
        query = """🔍 PREVIEW MODE - Neues Dashboard ohne Auto-Deploy

Read .scaffold_context and app_metadata.json.
Analyze data, decide UI paradigm in 1-2 sentences, then implement directly.
Follow .claude/skills/frontend-impl/SKILL.md.
Use existing types and services from src/types/ and src/services/.

⚠️ WICHTIG:
- Rufe NICHT deploy_to_github auf!
- Der User wird das Dashboard erst in der Live-Preview testen
- Wenn 'npm run build' erfolgreich ist, bist du fertig"""
        print(f"[KLAR-PREVIEW] Build-Mode: Neues Dashboard erstellen (Preview)")

    t_agent_total_start = time.time()
    print(f"[KLAR-PREVIEW] Initialisiere Client")

    # Client lifecycle
    async with ClaudeSDKClient(options=options) as client:
        # Build multimodal prompt if user attached an image
        if user_image_data:
            async def _multimodal_prompt():
                content = [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": user_image_data["media_type"],
                            "data": user_image_data["data"],
                        },
                    },
                    {"type": "text", "text": query},
                ]
                yield {
                    "type": "user",
                    "message": {"role": "user", "content": content},
                    "session_id": "default",
                }
            await client.query(_multimodal_prompt())
            print(f"[KLAR-PREVIEW] Multimodaler Prompt gesendet (Text + Bild)")
        else:
            await client.query(query)

        t_last_step = t_agent_total_start
        
        async for message in client.receive_response():
            now = time.time()
            elapsed = round(now - t_agent_total_start, 1)
            dt = round(now - t_last_step, 1)
            t_last_step = now
            
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(json.dumps({"type": "think", "content": block.text, "t": elapsed, "dt": dt}), flush=True)

                    elif isinstance(block, ToolUseBlock):
                        if block.name in ["Write", "Edit"]:
                            file_path = block.input.get('file_path', block.input.get('path', 'unknown'))
                            print(f"[LIVE] 📝 {block.name}: {file_path}", flush=True)

                        print(json.dumps({"type": "tool", "tool": block.name, "input": str(block.input), "t": elapsed, "dt": dt}), flush=True)

            elif isinstance(message, UserMessage):
                if isinstance(message.content, list):
                    for block in message.content:
                        if isinstance(block, ToolResultBlock) and _LOG_LEVEL == "debug":
                            content = str(block.content)[:4000] if block.content else ""
                            print(json.dumps({"type": "tool_result", "tool_use_id": block.tool_use_id, "output": content, "is_error": block.is_error, "t": elapsed}), flush=True)

            elif isinstance(message, ResultMessage):
                status = "success" if not message.is_error else "error"
                print(f"[KLAR-PREVIEW] Session ID: {message.session_id}")
                
                if message.session_id:
                    try:
                        with open("/home/user/app/.claude_session_id", "w") as f:
                            f.write(message.session_id)
                        print(f"[KLAR-PREVIEW] ✅ Session ID gespeichert")
                    except Exception as e:
                        print(f"[KLAR-PREVIEW] ⚠️ Fehler: {e}")
                
                t_agent_total = time.time() - t_agent_total_start
                print(json.dumps({
                    "type": "result", 
                    "status": status, 
                    "cost": message.total_cost_usd,
                    "session_id": message.session_id,
                    "duration_s": round(t_agent_total, 1)
                }), flush=True)
                
                print(f"[KLAR-PREVIEW] ✅ Änderungen abgeschlossen ({t_agent_total:.1f}s)")


if __name__ == "__main__":
    asyncio.run(main())


