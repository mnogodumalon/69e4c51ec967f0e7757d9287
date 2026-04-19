const AGENT_ENDPOINT = "https://my.living-apps.de/actions-agent";
const APPGROUP_ID = "69e4c51ec967f0e7757d9287";

export interface InputSchemaProperty {
  type: string;
  title?: string;
  description?: string;
  format?: string;
  enum?: string[];
}

export interface InputSchema {
  type: "object";
  properties: Record<string, InputSchemaProperty>;
  required?: string[];
  "x-preflight"?: boolean;
}

export interface ActionMetadata {
  title?: string;
  input_schema?: InputSchema;
  output_schema?: Record<string, unknown>;
  description?: string;
}

export interface Action {
  identifier: string;
  title: string;
  description: string;
  app_id: string;
  app_name: string;
  value: string;
  metadata: ActionMetadata | null;
}

export interface FileAttachment {
  identifier: string;
  filename: string;
  mime_type: string;
  url: string;
  app_id: string;
  app_name: string;
  created_at: string;
  action_identifier: string;
}

export async function fetchActionsAndFiles(): Promise<{ actions: Action[]; files: FileAttachment[] }> {
  const resp = await fetch(
    `${AGENT_ENDPOINT}/actions?appgroup_id=${APPGROUP_ID}`,
    { credentials: "include" },
  );
  if (!resp.ok) return { actions: [], files: [] };
  const data = await resp.json();
  const actions: Action[] = [];
  const files: FileAttachment[] = [];
  for (const app of data.apps || []) {
    for (const action of app.actions || []) {
      actions.push({
        identifier: action.identifier,
        title: action.title || "",
        description: action.description || "",
        app_id: app.app_id,
        app_name: app.app_name,
        value: action.value || "",
        metadata: action.metadata ?? null,
      });
    }
    for (const file of app.files || []) {
      files.push({
        identifier: file.identifier,
        filename: file.filename || file.identifier,
        mime_type: file.mime_type || "application/octet-stream",
        url: file.url || "",
        app_id: app.app_id,
        app_name: app.app_name,
        created_at: file.created_at || "",
        action_identifier: file.action_identifier || "",
      });
    }
  }
  return { actions, files };
}

export async function executeAction(
  appId: string,
  actionIdentifier: string,
  inputs?: Record<string, unknown>,
  files?: File[],
): Promise<{ stdout: string | null; error: string | null }> {
  let resp: Response;

  if (inputs || (files && files.length > 0)) {
    const formData = new FormData();
    formData.append("app_id", appId);
    formData.append("action_identifier", actionIdentifier);
    if (inputs) formData.append("inputs", JSON.stringify(inputs));
    if (files) {
      for (const file of files) formData.append("files", file);
    }
    resp = await fetch(`${AGENT_ENDPOINT}/execute`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
  } else {
    resp = await fetch(`${AGENT_ENDPOINT}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ app_id: appId, action_identifier: actionIdentifier }),
    });
  }

  const data = await resp.json();
  return { stdout: data.stdout ?? null, error: data.error ?? null };
}

export async function deleteAction(
  appId: string,
  actionIdentifier: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const resp = await fetch(
      `${AGENT_ENDPOINT}/actions/apps/${appId}/${actionIdentifier}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      return { ok: false, error: data?.detail || `HTTP ${resp.status}` };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteAppAttachment(
  appId: string,
  identifier: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const resp = await fetch(
      `${AGENT_ENDPOINT}/app-attachments/${appId}/${identifier}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      return { ok: false, error: data?.detail || `HTTP ${resp.status}` };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function downloadFile(url: string, filename: string): Promise<void> {
  const resp = await fetch(url, { credentials: "include" });
  const blob = await resp.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function parseDataUri(uri: string): { mimeType: string; data: string } | null {
  const m = uri.match(/^data:([^;]+);base64,(.+)$/s);
  return m ? { mimeType: m[1], data: m[2] } : null;
}

export async function agentChat(
  messages: Array<{ role: string; content: string; image?: string }>,
  threadId: string,
  onContent: (delta: string) => void,
): Promise<void> {
  const resp = await fetch(`${AGENT_ENDPOINT}/copilotkit/agents/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name: "klar-agent",
      threadId,
      state: {},
      properties: { appgroup_id: APPGROUP_ID },
      messages: messages.map((m) => {
        const parsed = m.image ? parseDataUri(m.image) : null;
        const content = parsed
          ? [
              { type: "text", text: m.content },
              { type: "binary", mimeType: parsed.mimeType, data: parsed.data },
            ]
          : m.content;
        return {
          id: crypto.randomUUID(),
          role: m.role,
          content,
          createdAt: new Date().toISOString(),
        };
      }),
      actions: [],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Agent API ${resp.status}: ${text.slice(0, 200)}`);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === "TextMessageContent") {
          onContent(event.content);
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    try {
      const event = JSON.parse(buffer);
      if (event.type === "TextMessageContent") {
        onContent(event.content);
      }
    } catch {
      // skip
    }
  }
}
