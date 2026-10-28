import { useEffect, useRef, useState } from "react";
import type { Concept, Theme, Connection } from "./graph";
export function Network({
  concepts,
  themes,
  edges,
  selected,
  lit,
  onSelect,
  onEdge,
  onMove,
}: {
  concepts: Concept[];
  themes: Theme[];
  edges: Connection[];
  selected: string | null;
  lit: Set<string>;
  onSelect: (id: string) => void;
  onEdge: (id: string) => void;
  onMove: (id: string, x: number, y: number) => Promise<boolean>;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(1000);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const gesture = useRef<{
    id: string | null;
    x: number;
    y: number;
    cx: number;
    cy: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const point = (x: number, y: number) => {
    const p = new DOMPoint(x, y).matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
    return { x: p.x, y: p.y };
  };
  const zoom = (factor: number) =>
    setCamera((c) => ({
      ...c,
      zoom: Math.max(0.25, Math.min(4, c.zoom * factor)),
    }));
  useEffect(() => {
    const el = svg.current!;
    const resize = new ResizeObserver(() =>
      setWidth(el.getBoundingClientRect().width),
    );
    resize.observe(el);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setCamera((c) => {
        const cursor = new DOMPoint(e.clientX, e.clientY).matrixTransform(
          el.getScreenCTM()!.inverse(),
        );
        const z = Math.max(
          0.25,
          Math.min(4, c.zoom * Math.exp(-e.deltaY * 0.0015)),
        );
        return {
          x: cursor.x - ((cursor.x - c.x) * c.zoom) / z,
          y: cursor.y - ((cursor.y - c.y) * c.zoom) / z,
          zoom: z,
        };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      resize.disconnect();
      el.removeEventListener("wheel", wheel);
    };
  }, []);
  async function commitPosition(id: string, x: number, y: number) {
    await onMove(id, x, y);
    // Read the persisted props again, including rollback after a failed save or Undo.
    setPositions((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
  }
  const unit = 1000 / (Math.max(250, width) * camera.zoom);
  const locate = (c: Concept) => positions[c.id] ?? c;
  return (
    <div className="network-wrap">
      <div className="network-tools">
        <button aria-label="Zoom in" onClick={() => zoom(1.25)}>
          +
        </button>
        <button aria-label="Zoom out" onClick={() => zoom(0.8)}>
          −
        </button>
        <button onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}>
          Reset view
        </button>
        <span>{Math.round(camera.zoom * 100)}%</span>
      </div>
      <svg
        ref={svg}
        className="keyword-network"
        role="group"
        aria-label="Keyword knowledge graph"
        viewBox={`${camera.x} ${camera.y} ${1000 / camera.zoom} ${600 / camera.zoom}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={(e) => {
          const node =
            (e.target as Element)
              .closest("[data-node]")
              ?.getAttribute("data-node") ?? null;
          if (!node && (e.target as Element).closest("[data-edge]")) return;
          const p = point(e.clientX, e.clientY),
            c = concepts.find((c) => c.id === node);
          gesture.current = {
            id: node,
            x: p.x,
            y: p.y,
            cx: camera.x,
            cy: camera.y,
            startX: c ? locate(c).x : 0,
            startY: c ? locate(c).y : 0,
            moved: false,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g) return;
          const p = point(e.clientX, e.clientY),
            dx = p.x - g.x,
            dy = p.y - g.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true;
          if (g.id)
            setPositions((old) => ({
              ...old,
              [g.id!]: { x: g.startX + dx, y: g.startY + dy },
            }));
          else {
            setCamera((c) => ({ ...c, x: c.x - dx, y: c.y - dy }));
          }
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          gesture.current = null;
          if (!g) return;
          e.currentTarget.releasePointerCapture(e.pointerId);
          if (g.id) {
            const p = positions[g.id];
            if (g.moved && p) void commitPosition(g.id, p.x, p.y);
            else onSelect(g.id);
          }
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setPositions({});
        }}
      >
        <defs>
          <pattern
            id="dots"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.65" fill="#bdc7b5" />
          </pattern>
        </defs>
        <rect
          x={camera.x}
          y={camera.y}
          width={1000 / camera.zoom}
          height={600 / camera.zoom}
          fill="url(#dots)"
        />
        {edges
          .filter((e) => !e.excluded)
          .map((e) => {
            const a = concepts.find((c) => c.id === e.source),
              b = concepts.find((c) => c.id === e.target);
            if (!a || !b) return null;
            const p = locate(a),
              q = locate(b),
              active = lit.has(a.id) && lit.has(b.id);
            return (
              <g
                key={e.id}
                data-edge={e.id}
                role="button"
                tabIndex={0}
                aria-label={`Connection: ${a.label} — ${b.label}`}
                onClick={() => onEdge(e.id)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onEdge(e.id);
                  }
                }}
                opacity={active ? 0.75 : 0.08}
              >
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={q.x}
                  y2={q.y}
                  stroke="#899d7c"
                  strokeWidth={1.5 + Math.min(4, e.supportCount)}
                  strokeDasharray={e.manual ? "6 4" : undefined}
                />
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={q.x}
                  y2={q.y}
                  stroke="transparent"
                  strokeWidth={14}
                  className="edge-hit"
                />
              </g>
            );
          })}
        {concepts.map((c) => {
          const p = locate(c),
            active = lit.has(c.id);
          return (
            <g
              key={c.id}
              data-node={c.id}
              transform={`translate(${p.x},${p.y})`}
              opacity={active ? 1 : 0.12}
              role="button"
              tabIndex={0}
              aria-label={`Concept: ${c.label}`}
              aria-pressed={selected === c.id}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(c.id);
                }
                if (
                  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault();
                  const x =
                      p.x +
                      (e.key === "ArrowLeft"
                        ? -10
                        : e.key === "ArrowRight"
                          ? 10
                          : 0),
                    y =
                      p.y +
                      (e.key === "ArrowUp"
                        ? -10
                        : e.key === "ArrowDown"
                          ? 10
                          : 0);
                  setPositions((old) => ({ ...old, [c.id]: { x, y } }));
                  void commitPosition(c.id, x, y);
                }
              }}
            >
              <circle
                r={(selected === c.id ? 13 : 9) * unit}
                fill={
                  themes.find((t) => t.id === c.topicId)?.color ?? "#829678"
                }
                stroke={selected === c.id ? "#354a32" : "#fffdf4"}
                strokeWidth={selected === c.id ? 3 : 2}
              />
              <text
                y={-20 * unit}
                textAnchor="middle"
                className="concept-label"
                style={{ fontSize: 13 * unit }}
              >
                {c.label}
              </text>
            </g>
          );
        })}
      </svg>
      {!concepts.length && (
        <div className="network-empty">
          No concepts yet. Write a thought or add a concept.
        </div>
      )}
      <p className="network-hint">
        Drag background to pan · Scroll to zoom · Drag a concept to place it ·
        Arrow keys move a focused node
      </p>
    </div>
  );
}
