import React, { useRef, useState } from "react";
import { io } from "socket.io-client";

const BACKEND = import.meta.env.VITE_BACKEND_HTTP;
const GRPC_WEB = import.meta.env.VITE_GRPC_WEB;

function Section({ title, children }) {
  return (
    <div style={{ border: "1px solid #ddd", padding: 16, borderRadius: 10, marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  );
}
function Explain({ text }) {
  return <p style={{ marginTop: 8, color: "#444" }}><b>Explanation:</b> {text}</p>;
}

export default function App() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("demo");
  const [items, setItems] = useState([]);
  const [name, setName] = useState("sample-item");
  const [updateId, setUpdateId] = useState("");
  const [deleteId, setDeleteId] = useState("");

  const [gqlItems, setGqlItems] = useState([]);

  const socketRef = useRef(null);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [room, setRoom] = useState("lobby");
  const [chatMsg, setChatMsg] = useState("hello");
  const [chatFeed, setChatFeed] = useState([]);

  const [grpcHello, setGrpcHello] = useState("");
  const [grpcStream, setGrpcStream] = useState([]);
  const grpcStreamTimer = useRef(null);

  async function login() {
    const r = await fetch(`${BACKEND}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "demo" })
    });
    const data = await r.json();
    setToken(data.token || "");
  }

  function authHeaders() {
    return { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  }

  async function restGet() {
    const r = await fetch(`${BACKEND}/api/items`, { headers: authHeaders() });
    const data = await r.json();
    setItems(data.items || []);
  }

  async function restPost() {
    const r = await fetch(`${BACKEND}/api/items`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name })
    });
    if (r.ok) await restGet();
  }

  async function restPut() {
    const r = await fetch(`${BACKEND}/api/items/${updateId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ name })
    });
    if (r.ok) await restGet();
  }

  async function restDelete() {
    const r = await fetch(`${BACKEND}/api/items/${deleteId}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (r.ok) await restGet();
  }

  async function gqlQueryItems() {
    const r = await fetch(`${BACKEND}/graphql`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ query: `query { items { id name created_at } }` })
    });
    const data = await r.json();
    setGqlItems(data?.data?.items || []);
  }

  async function gqlMutationCreate() {
    const r = await fetch(`${BACKEND}/graphql`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        query: `mutation($name:String!) { createItem(name:$name) { id name created_at } }`,
        variables: { name }
      })
    });
    if (r.ok) await gqlQueryItems();
  }

  async function publishRabbit() {
    await fetch(`${BACKEND}/api/queue/publish`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ source: "vite", action: "publishRabbit", ts: Date.now() })
    });
  }

  async function produceKafka() {
    await fetch(`${BACKEND}/api/kafka/produce`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ source: "vite", action: "produceKafka", ts: Date.now() })
    });
  }

  function wsConnect() {
    if (!token) return alert("Login first");
    if (socketRef.current) socketRef.current.disconnect();

    const s = io(BACKEND, { transports: ["websocket"], auth: { token } });
    socketRef.current = s;

    s.on("connect", () => setWsStatus("connected"));
    s.on("disconnect", () => setWsStatus("disconnected"));
    s.on("chat:message", (msg) => setChatFeed((prev) => [msg, ...prev]));
  }

  function wsJoinRoom() {
    const s = socketRef.current;
    if (!s) return;
    s.emit("room:join", room, (ack) => {
      setChatFeed((prev) => [{ system: true, text: `Joined ${room}`, ack }, ...prev]);
    });
  }

  function wsSend() {
    const s = socketRef.current;
    if (!s) return;
    s.emit("chat:send", { room, message: chatMsg }, (ack) => {
      setChatFeed((prev) => [{ system: true, text: `Sent to ${room}`, ack }, ...prev]);
    });
  }

  function wsDisconnect() {
    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = null;
  }

  async function grpcSayHello() {
    setGrpcHello("gRPC-web stub: use grpc-web codegen for true browser gRPC calls via Envoy.");
  }

  function grpcStartStream() {
    setGrpcStream((prev) => [{ note: "gRPC stream stub - implement grpc-web stubs for real streaming" }, ...prev]);
    clearInterval(grpcStreamTimer.current);
    grpcStreamTimer.current = setInterval(() => {
      setGrpcStream((prev) => [{ isoTime: new Date().toISOString() }, ...prev].slice(0, 10));
    }, 1000);
  }

  function grpcStopStream() {
    clearInterval(grpcStreamTimer.current);
    grpcStreamTimer.current = null;
  }

  return (
    <div style={{ fontFamily: "Arial", padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1>DevOps Protocol Playground (Vite)</h1>
      <p>Backend: {BACKEND} | gRPC-web proxy: {GRPC_WEB}</p>

      <Section title="Auth (JWT)">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          <button onClick={login}>Login</button>
          <span style={{ wordBreak: "break-all" }}>{token ? `Token: ${token.slice(0, 24)}...` : "No token"}</span>
        </div>
        <Explain text="Login via REST to get JWT. Use it for protected REST, GraphQL, Rabbit/Kafka triggers, and Socket.IO handshake." />
      </Section>

      <Section title="REST API actions (GET/POST/PUT/DELETE)">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={restGet}>GET /api/items</button>
          <button onClick={restPost}>POST /api/items</button>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="item name" />
          <input value={updateId} onChange={(e) => setUpdateId(e.target.value)} placeholder="PUT id" />
          <button onClick={restPut}>PUT /api/items/:id</button>
          <input value={deleteId} onChange={(e) => setDeleteId(e.target.value)} placeholder="DELETE id" />
          <button onClick={restDelete}>DELETE /api/items/:id</button>
        </div>
        <Explain text="REST: GET reads, POST creates, PUT updates (idempotent), DELETE removes (idempotent). JWT required." />
        <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8 }}>{JSON.stringify(items, null, 2)}</pre>
      </Section>

      <Section title="GraphQL actions (Query + Mutation)">
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={gqlQueryItems}>Query items</button>
          <button onClick={gqlMutationCreate}>Mutation createItem</button>
        </div>
        <Explain text="GraphQL: Query selects fields. Mutation changes data. JWT required." />
        <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8 }}>{JSON.stringify(gqlItems, null, 2)}</pre>
      </Section>

      <Section title="RabbitMQ + Kafka triggers">
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={publishRabbit}>Publish RabbitMQ</button>
          <button onClick={produceKafka}>Produce Kafka</button>
        </div>
        <Explain text="Frontend triggers REST. Backend publishes to RabbitMQ / produces to Kafka. Consumers log received messages." />
      </Section>

      <Section title="WebSocket (Socket.IO)">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={wsConnect}>Connect</button>
          <button onClick={wsDisconnect}>Disconnect</button>
          <span>Status: {wsStatus}</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="room" />
          <button onClick={wsJoinRoom}>Join room</button>
          <input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} placeholder="message" />
          <button onClick={wsSend}>Send message</button>
        </div>
        <Explain text="Socket.IO: connect with token, join room, emit messages, receive broadcast, disconnect." />
        <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8 }}>{JSON.stringify(chatFeed.slice(0, 10), null, 2)}</pre>
      </Section>

      <Section title="gRPC actions (Unary + Streaming)">
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={grpcSayHello}>Unary: SayHello</button>
          <button onClick={grpcStartStream}>Start stream</button>
          <button onClick={grpcStopStream}>Stop stream</button>
        </div>
        <Explain text="gRPC Unary is one request → one response. Server-stream is one request → many responses. Browser requires grpc-web (Envoy proxy + generated stubs)." />
        <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8 }}>
          {JSON.stringify({ grpcHello, grpcStream }, null, 2)}
        </pre>
      </Section>

      <Section title="Swagger">
        <p>Swagger UI: <a href={`${BACKEND}/docs`} target="_blank" rel="noreferrer">{BACKEND}/docs</a></p>
      </Section>
    </div>
  );
}
