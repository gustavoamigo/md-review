import { SampleDocument } from '../types';

export const sampleDocs: SampleDocument[] = [
  {
    id: 'architecture-spec',
    title: 'HyperScale Event Engine Spec',
    filename: 'architecture-spec.md',
    badge: 'Spec',
    description: 'Distributed event processing engine specification with Mermaid sequence diagrams, state machines, and API schemas.',
    content: `# HyperScale Event Engine Specification

## Overview

HyperScale is an ultra-low-latency event pipeline engineered for real-time telemetry streaming, distributed state aggregation, and high-throughput transaction auditing. The engine achieves sub-5ms p99 latency across globally distributed consumer groups by utilizing memory-mapped lock-free ring buffers and zero-copy protocol serialization.

Every request is cryptographically signed, timestamped via monotonic hardware clocks, and persisted to dual NVMe write-ahead logs before acknowledgment.

## System Architecture

The following diagram illustrates the ingestion flow from external ingest gateways through validation filters to the partitioned write-ahead ring buffer:

\`\`\`mermaid
flowchart TD
    Client[Edge Clients] -->|TLS 1.3 Streaming| Gateway[API Ingestion Gateway]
    Gateway --> AuthFilter[Signature & Auth Validator]
    AuthFilter --> SchemaRegistry[Protobuf Schema Verifier]
    SchemaRegistry --> RingBuffer[Lock-Free Ring Buffer]
    
    subgraph Storage Tier
        RingBuffer --> WAL[Dual NVMe Write-Ahead Log]
        RingBuffer --> Indexer[LSM-Tree Index Engine]
    end

    subgraph Egress Engine
        Indexer --> ReplicaPool[Distributed Replicas]
        ReplicaPool --> KafkaSink[Apache Kafka Bridge]
        ReplicaPool --> RealtimeSocket[WebSocket Real-time Feed]
    end
\`\`\`

## Transaction Ingestion Protocol

When an event transaction arrives, the gateway coordinates with the consensus coordinator using an atomic two-phase commit sequence:

\`\`\`mermaid
sequenceDiagram
    autonumber
    actor Client as IoT Edge Device
    participant Gateway as Ingest Gateway
    participant Consensus as Raft Consensus Group
    participant Storage as NVMe Storage Pool

    Client->>Gateway: POST /v2/events/publish (Protobuf Batch)
    Gateway->>Gateway: Compute SHA-256 Checksum & Validate
    Gateway->>Consensus: Propose Log Entry(Term 42, Index 1024)
    Consensus-->>Gateway: Quorum Acknowledged (3 of 5 nodes)
    Gateway->>Storage: Direct I/O Page Write (O_DIRECT)
    Storage-->>Gateway: fsync completed
    Gateway-->>Client: 202 Accepted { txn_id: "0x8F9A2B" }
\`\`\`

## Schema Definition

Events adhere to a strict protocol buffer schema defining payload guarantees:

\`\`\`typescript
export interface EventEnvelope {
  eventId: string;
  partitionKey: string;
  sourceTimestampNs: bigint;
  schemaVersion: number;
  payloadType: 'telemetry' | 'state_mutation' | 'audit_log';
  metadata: Record<string, string>;
  checksum: string;
  payload: Uint8Array;
}

export interface PartitionHealth {
  partitionId: number;
  leaderNode: string;
  inSyncReplicas: string[];
  lagBytes: number;
  isDegraded: boolean;
}
\`\`\`

## Performance Targets and SLAs

The architecture guarantees strict operating envelopes under heavy production workloads:

| Metric | Target SLA | Degraded Threshold | Fallback Behavior |
| :--- | :--- | :--- | :--- |
| Ingestion p50 Latency | < 1.2 ms | > 3.0 ms | Shed non-critical debug telemetry |
| Ingestion p99 Latency | < 4.8 ms | > 10.0 ms | Enable backpressure upstream |
| Sustained Ingestion Rate | 250,000 evt/s | < 180,000 evt/s | Spin up auxiliary worker pods |
| Cluster Failover Duration | < 850 ms | > 2,000 ms | Promote warm replica partition |

## Disaster Recovery & Failover

In the event of network partitioning between availability zones, the consensus group automatically pauses non-idempotent writes to avoid split-brain states. Read replicas continue serving cached state queries with an explicit stale-epoch warning header.
`,
  },
  {
    id: 'project-readme',
    title: 'MarkSmith CLI & Engine',
    filename: 'README.md',
    badge: 'README',
    description: 'Open-source documentation toolkit with live formatting, diagram compilation, and static asset bundlers.',
    content: `# MarkSmith

A lightning-fast, zero-dependency Markdown parser and static review engine built for modern developer documentation.

## Features

- Zero runtime dependencies for core AST transformation
- First-class support for Mermaid.js sequence and entity relationship diagrams
- Integrated syntax highlighting with automatic language detection
- Full CommonMark and GitHub Flavored Markdown (GFM) compliance
- Live watch mode with incremental diff generation

## Quickstart

Install MarkSmith globally via npm or your preferred package manager:

\`\`\`bash
npm install -g marksmith-cli
marksmith init my-project-docs
cd my-project-docs && marksmith dev
\`\`\`

## Pipeline Architecture

\`\`\`mermaid
graph LR
    Source[Raw Markdown] --> Lexer[Token Stream]
    Lexer --> Parser[AST Builder]
    Parser --> MermaidPlugin[Mermaid Pre-compiler]
    MermaidPlugin --> HtmlGen[Static HTML Output]
\`\`\`

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| \`strictDiagrams\` | boolean | \`true\` | Fail build on invalid Mermaid syntax |
| \`theme\` | string | \`"system"\` | Editor color palette ("dark" or "light") |
| \`diffTracking\` | boolean | \`true\` | Track paragraph revisions in local cache |

## License

MIT © Gustavo Amigo & MarkSmith Contributors.
`,
  },
  {
    id: 'incident-runbook',
    title: 'PostgreSQL Database Failover Runbook',
    filename: 'database-failover-runbook.md',
    badge: 'Runbook',
    description: 'Critical incident response guide for automated primary database promotion and replication resynchronization.',
    content: `# Runbook: PostgreSQL High-Availability Failover

## Severity Level: SEV-1 (Critical)

This runbook guides on-call site reliability engineers through the safe failover and promotion of the primary PostgreSQL database cluster during an unplanned hardware or network outage.

## Initial Assessment Checklist

1. Verify whether the primary database is truly unreachable or simply experiencing high CPU contention.
2. Confirm that replica standby nodes have less than 50MB of replication lag.
3. Check the alert channel for concurrent cloud region infrastructure incidents.

\`\`\`mermaid
flowchart TD
    Alarm[PagerDuty SEV-1 Alert] --> HealthCheck{Is Primary Responding?}
    HealthCheck -- Yes --> Diagnose[Inspect Slow Query Log & Locks]
    HealthCheck -- No --> LagCheck{Standby Lag < 50MB?}
    LagCheck -- Yes --> Promote[Run Automated Failover Script]
    LagCheck -- No --> ManualSync[Manual WAL Replay & Force Promotion]
    Promote --> HealthVerify[Verify Read/Write Health]
    ManualSync --> HealthVerify
\`\`\`

## Failover Execution Commands

Run the following cluster orchestration command from the secure bastion host:

\`\`\`bash
# 1. Check standby replication status
patronictl -c /etc/patroni/db-cluster.yml list

# 2. Trigger graceful failover to standby replica db-node-02
patronictl -c /etc/patroni/db-cluster.yml failover --candidate db-node-02

# 3. Verify application pool reconnection
kubectl rollout restart deployment/api-gateway -n production
\`\`\`

## Contact Escalations

| Role | Contact | Primary Channel | Backup Phone |
| :--- | :--- | :--- | :--- |
| Primary Database On-Call | Gustavo Amigo | #db-war-room | +1 (555) 019-2831 |
| Infrastructure Lead | Sarah Chen | #infra-emergency | +1 (555) 019-4492 |
| Incident Commander | Alex Rivera | #incident-bridge | +1 (555) 019-8730 |
`,
  },
];
