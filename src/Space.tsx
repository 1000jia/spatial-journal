import { Component, useRef, useMemo, useEffect, type ReactNode } from "react";
import { Group, Vector3, CanvasTexture, SRGBColorSpace } from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { type Entry } from "./model";
// Canvas textures keep labels inside WebGL, avoiding independently mounted DOM roots.
function PaperText({
  entry,
  label = false,
  onSelect,
}: {
  entry: Entry;
  label?: boolean;
  onSelect?: () => void;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = label ? 256 : 360;
    canvas.height = label ? 64 : 700;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = label ? "#f5f5ed" : "#fffbee";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#4b5948";
    if (label) {
      ctx.font = "26px Arial";
      ctx.textAlign = "center";
      ctx.fillText(entry.primaryTopic, 128, 42);
    } else {
      ctx.font = "15px Arial";
      ctx.fillText(new Date(entry.createdAt).toLocaleDateString(), 35, 48);
      ctx.fillText(entry.primaryTopic + (entry.demo ? " · DEMO" : ""), 35, 79);
      ctx.font = "22px Georgia";
      let y = 130;
      for (const paragraph of entry.text.split("\n")) {
        let line = "";
        for (const word of paragraph.split(" ")) {
          if (ctx.measureText(line + word).width > 282 && line) {
            ctx.fillText(line, 35, y);
            y += 32;
            line = "";
          }
          line += word + " ";
          if (y > 630) break;
        }
        if (y > 630) {
          ctx.fillText("… Open note to continue", 35, 658);
          break;
        }
        ctx.fillText(line, 35, y);
        y += 42;
      }
    }
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, [entry.text, entry.primaryTopic, entry.createdAt, entry.demo, label]);
  useEffect(() => () => texture.dispose(), [texture]);
  return label ? (
    <sprite position={[0, 0.28, 0]} scale={[0.8, 0.2, 1]}>
      <spriteMaterial map={texture} depthTest={false} />
    </sprite>
  ) : (
    <mesh
      position={[0, 0, 0.021]}
      onClick={(ev) => {
        ev.stopPropagation();
        onSelect?.();
      }}
    >
      <planeGeometry args={[2.06, 4.06]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty">3D unavailable. Browse your notes below.</div>
    ) : (
      this.props.children
    );
  }
}
function AnimatedGroup({
  target,
  reduced,
  children,
}: {
  target: [number, number, number];
  reduced: boolean;
  children: ReactNode;
}) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ref.current)
      ref.current.position.lerp(
        new Vector3(...target),
        reduced ? 1 : Math.min(1, delta * 8),
      );
  });
  return <group ref={ref}>{children}</group>;
}
export function Space({
  entries,
  selected,
  onSelect,
  archive = false,
  timeline = false,
  index = 0,
  reduced = false,
}: {
  entries: Entry[];
  selected: string | null;
  onSelect: (e: Entry) => void;
  archive?: boolean;
  timeline?: boolean;
  index?: number;
  reduced?: boolean;
}) {
  return (
    <Boundary>
      <Canvas shadows camera={{ position: [0, 0, 10], fov: 45 }} dpr={[1, 1.5]}>
        <ambientLight intensity={2} />
        <directionalLight position={[4, 6, 8]} intensity={3} castShadow />
        <OrbitControls
          enableDamping
          minDistance={5}
          maxDistance={18}
          enableRotate={!archive}
          enableZoom={!archive}
        />
        {entries.map((e, i) => {
          if (archive && i < index) return null;
          const active =
            !selected ||
            selected === e.id ||
            entries
              .find((n) => n.id === selected)
              ?.related.some((r) => r.id === e.id);
          return (
            <AnimatedGroup
              key={e.id}
              reduced={reduced}
              target={
                archive
                  ? [
                      timeline ? Math.sin(i) * 0.6 : (i - index) * 0.16,
                      archive ? (i - index) * -0.09 : 0,
                      timeline ? (index - i) * 1.5 : -(i - index) * 0.14,
                    ]
                  : e.coordinates
              }
            >
              <mesh
                castShadow
                receiveShadow
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelect(e);
                }}
              >
                <boxGeometry args={[2.1, 4.1, 0.035]} />
                <meshStandardMaterial
                  color="#fffbee"
                  transparent
                  opacity={active ? 1 : 0.18}
                  roughness={0.7}
                />
              </mesh>
              {archive &&
                Array.from({ length: 10 }, (_, hole) => (
                  <mesh key={hole} position={[-0.96, 1.8 - hole * 0.39, 0.025]}>
                    <circleGeometry args={[0.035, 12]} />
                    <meshBasicMaterial color="#b2b9a5" />
                  </mesh>
                ))}
              {archive && i >= index && i < index + 8 && (
                <PaperText entry={e} onSelect={() => onSelect(e)} />
              )}
            </AnimatedGroup>
          );
        })}
      </Canvas>
    </Boundary>
  );
}
