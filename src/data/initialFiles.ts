import { FileNode } from '../types';
import { sampleDocs } from './sampleDocs';

export const initialFiles: FileNode[] = [
  // Root Folders
  {
    id: 'folder-docs',
    name: 'docs',
    type: 'folder',
    parentId: null,
    isOpen: true,
  },
  {
    id: 'folder-diagrams',
    name: 'diagrams',
    type: 'folder',
    parentId: null,
    isOpen: true,
  },

  // Files in docs/
  {
    id: 'file-architecture-spec',
    name: 'architecture-spec.md',
    type: 'file',
    parentId: 'folder-docs',
    content: sampleDocs[0].content,
  },
  {
    id: 'file-api-gateway',
    name: 'api-gateway.md',
    type: 'file',
    parentId: 'folder-docs',
    content: `# API Gateway & Ingestion Specification

## Overview

The Edge API Gateway coordinates incoming gRPC and HTTP/2 traffic, authenticates tokens using asymmetric ECDSA cryptography, and enforces granular sliding-window rate limits across edge nodes.

## Authentication & Rate Limiting Flow

When a client initiates an API call, the gateway verifies the JWT bearer token with the authorization service before routing:

\`\`\`mermaid
sequenceDiagram
    autonumber
    actor Client
    participant GW as API Gateway
    participant Redis as Rate Limiter (Redis)
    participant Auth as Auth Service
    participant Svc as Core Microservice

    Client->>GW: POST /v1/orders (Bearer JWT)
    GW->>Redis: Check Sliding Window Limit(client_id, 100/min)
    alt Rate Limit Exceeded
        Redis-->>GW: Limit Exceeded (HTTP 429)
        GW-->>Client: 429 Too Many Requests
    else Limit Within Threshold
        Redis-->>GW: OK (Usage: 42/100)
        GW->>Auth: Validate JWT & Scopes
        Auth-->>GW: Token Valid { sub: "user-921", role: "admin" }
        GW->>Svc: Forward Request with Claims Header
        Svc-->>GW: 201 Created { order_id: "ord-883" }
        GW-->>Client: 201 Created
    end
\`\`\`

## Edge Rate Limiting Policies

| Tier | Request Limit | Burst Allowance | SLA Guarantee |
| :--- | :--- | :--- | :--- |
| Free | 60 req/min | 10 requests | 99.5% uptime |
| Pro | 600 req/min | 50 requests | 99.9% uptime |
| Enterprise | 6,000 req/min | 500 requests | 99.99% uptime |
`,
  },
  {
    id: 'file-database-failover',
    name: 'database-failover.md',
    type: 'file',
    parentId: 'folder-docs',
    content: sampleDocs[2].content,
  },

  // Files in diagrams/
  {
    id: 'file-auth-sequence',
    name: 'auth-sequence.mmd',
    type: 'file',
    parentId: 'folder-diagrams',
    content: `\`\`\`mermaid
sequenceDiagram
    autonumber
    actor User as Web Browser
    participant App as Frontend SPA
    participant Auth as Identity Provider
    participant API as Resource Server

    User->>App: Click "Sign in with SSO"
    App->>Auth: GET /oauth/authorize (PKCE Challenge)
    Auth->>User: Display Login & MFA Challenge
    User->>Auth: Submit Credentials & OTP
    Auth-->>App: Redirect with Authorization Code
    App->>Auth: POST /oauth/token (Code + Verifier)
    Auth-->>App: Return Access Token + Refresh Token
    App->>API: GET /api/v1/user/profile (Bearer Access Token)
    API-->>App: 200 OK User Profile Data
\`\`\``,
  },
  {
    id: 'file-cluster-topology',
    name: 'cluster-topology.mmd',
    type: 'file',
    parentId: 'folder-diagrams',
    content: `\`\`\`mermaid
flowchart TD
    DNS[Cloudflare Anycast DNS] --> LB[Envoy Edge Proxy Load Balancer]
    
    subgraph Frontend Pods
        LB --> Web1[Web Instance A]
        LB --> Web2[Web Instance B]
    end

    subgraph Service Mesh
        Web1 --> APIGateway[Krakend API Gateway]
        Web2 --> APIGateway
        APIGateway --> OrderService[Order Microservice]
        APIGateway --> BillingService[Billing Microservice]
        APIGateway --> InventoryService[Inventory Microservice]
    end

    subgraph Cache Tier
        OrderService --> RedisPrimary[(Redis Cluster Primary)]
        RedisPrimary --> RedisReplica[(Redis Read Replica)]
    end

    subgraph Database Tier
        OrderService --> PGPrimary[(PostgreSQL Primary)]
        BillingService --> PGPrimary
        PGPrimary --> PGStandby[(PostgreSQL Hot Standby)]
    end
\`\`\``,
  },
  {
    id: 'file-order-lifecycle',
    name: 'order-lifecycle.mmd',
    type: 'file',
    parentId: 'folder-diagrams',
    content: `\`\`\`mermaid
stateDiagram-v2
    [*] --> Draft : Customer creates cart
    Draft --> PendingPayment : Checkout submitted
    
    state PendingPayment {
        [*] --> Authorizing
        Authorizing --> Captured : Payment approved
        Authorizing --> PaymentFailed : Card declined
    }

    PaymentFailed --> PendingPayment : Retry payment
    PaymentFailed --> Cancelled : Timeout 24h
    Captured --> Processing : Sent to warehouse
    
    Processing --> Shipped : Carrier picked up
    Shipped --> Delivered : Customer confirmed
    Delivered --> [*]
    
    Cancelled --> [*]
\`\`\``,
  },

  // Root File
  {
    id: 'file-readme',
    name: 'README.md',
    type: 'file',
    parentId: null,
    content: sampleDocs[1].content,
  },
];
