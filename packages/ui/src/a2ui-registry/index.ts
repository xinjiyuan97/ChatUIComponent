/**
 * @xinjiyuan97/ui/a2ui-registry — the default A2UI component set.
 *
 * These are the components an agent can name in a spec. Keep the surface small and
 * boring: every entry here is a capability you are handing to model output, so a
 * component that can navigate, fetch, or execute does not belong in the default set.
 *
 * Extend incrementally rather than replacing:
 *
 *   const registry = { ...defaultA2UIRegistry, Chart: MyChart }
 *
 * Lookup is case-insensitive, so a spec saying `button`, `Button` or `BUTTON` all resolve.
 */

import type { A2UIRegistry } from '@xinjiyuan97/a2ui'

import { Card, Column, Divider, Field, Form, Row, Spacer } from './layout'
import {
  Alert,
  Badge,
  CodeBlock,
  Heading,
  Icon,
  Image,
  KeyValue,
  Link,
  List,
  Markdown,
  Progress,
  Table,
  Text,
} from './content'
import { Button, Checkbox, Input, RadioGroup, Select, Textarea } from './controls'

export * from './props'
export * from './layout'
export * from './content'
export * from './controls'

/** Structure only — no text, no controls. */
export const layoutRegistry: A2UIRegistry = {
  Card,
  Row,
  Column,
  Divider,
  Spacer,
  Form,
  Field,
}

/** Read-only presentation. Safe to use on its own when a surface must not be interactive. */
export const contentRegistry: A2UIRegistry = {
  Text,
  Heading,
  Markdown,
  CodeBlock,
  Link,
  Image,
  Badge,
  Alert,
  Progress,
  List,
  Table,
  KeyValue,
  Icon,
}

/** Anything that can produce an action or hold form state. */
export const controlRegistry: A2UIRegistry = {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  RadioGroup,
}

/* Named export only. A default alongside named exports makes the CJS build ambiguous —
 * consumers would reach it as `require(...).default` on one path and `require(...)` on
 * another, which is exactly the interop trap this entry point does not need. */
export const defaultA2UIRegistry: A2UIRegistry = {
  ...layoutRegistry,
  ...contentRegistry,
  ...controlRegistry,
}
