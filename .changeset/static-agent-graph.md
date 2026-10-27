---
'@xinjiyuan97/chat-core': minor
'@xinjiyuan97/chat-ui': minor
---

Add AgentGraph, an infinite canvas viewer for Mina static Agent definitions with v2 triggers and v1 snapshot support. Includes automatic layout, pan/zoom, draggable nodes, a minimap, subscription and configuration inspection, and host-provided execution statuses. Export renderer-independent graph types and topology derivation from core. Import chat-ui/graph.css alongside the existing theme styles.

Add node configuration dialogs with JSON editing, host-managed async saving, validation and failure feedback, and a read-only fallback. Configuration updates preserve the canvas viewport.

Add strict YAML/JSON parsing and browser file reading in core, plus AgentGraphFile for file selection, drag/drop and graph preview. Failed imports retain the existing graph and surface syntax or structural diagnostics.
