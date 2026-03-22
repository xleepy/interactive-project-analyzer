import { useRef, useMemo } from 'react'
import { Canvas, extend, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'
import treeData from '../data/analysis/tree.json'

extend({ OrbitControls })

type TreeNode = {
  name: string
  type: 'file' | 'folder'
  path: string
  ext?: string
  children?: TreeNode[]
  imports?: string[]
  importedBy?: string[]
}

interface FlatNode extends TreeNode {
  depth: number
  position: [number, number, number]
}

function flattenTree(node: TreeNode, depth = 0, result: FlatNode[] = []): FlatNode[] {
  const phi = Math.acos(2 * Math.random() - 1)
  const theta = Math.random() * Math.PI * 2
  const r = 5 + depth * 10 + Math.random() * 6
  result.push({
    ...node,
    depth,
    position: [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ],
  })
  node.children?.forEach(child => flattenTree(child, depth + 1, result))
  return result
}

function CameraControls() {
  const { camera, gl } = useThree()
  const ref = useRef<InstanceType<typeof OrbitControls>>(null)
  useFrame(() => ref.current?.update())
  // @ts-ignore — extended JSX element
  return <orbitControls ref={ref} args={[camera, gl.domElement]} enableDamping dampingFactor={0.05} />
}

function Stars({ nodes }: { nodes: FlatNode[] }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(nodes.length * 3)
    nodes.forEach((n, i) => {
      arr[i * 3]     = n.position[0]
      arr[i * 3 + 1] = n.position[1]
      arr[i * 3 + 2] = n.position[2]
    })
    return arr
  }, [nodes])

  const colors = useMemo(() => {
    const arr = new Float32Array(nodes.length * 3)
    const folderColor = new THREE.Color('#ffd700') // gold
    const fileColor   = new THREE.Color('#88ccff') // blue-white
    nodes.forEach((n, i) => {
      const c = n.type === 'folder' ? folderColor : fileColor
      arr[i * 3]     = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    })
    return arr
  }, [nodes])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={nodes.length} itemSize={3} />
        <bufferAttribute attach="attributes-color"    array={colors}    count={nodes.length} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={1.4} vertexColors sizeAttenuation transparent opacity={0.9} />
    </points>
  )
}

function ImportLines({ nodes }: { nodes: FlatNode[] }) {
  const pathToPos = useMemo(() => {
    const map = new Map<string, [number, number, number]>()
    nodes.forEach(n => map.set(n.path, n.position))
    return map
  }, [nodes])

  const linePositions = useMemo(() => {
    const pts: number[] = []
    nodes.forEach(n => {
      n.imports?.forEach(imp => {
        const from = pathToPos.get(n.path)
        const to   = pathToPos.get(imp)
        if (from && to) pts.push(...from, ...to)
      })
    })
    return new Float32Array(pts)
  }, [nodes, pathToPos])

  if (linePositions.length === 0) return null

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={linePositions}
          count={linePositions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#334488" transparent opacity={0.35} />
    </lineSegments>
  )
}

const nodes = flattenTree(treeData as TreeNode)

export default function StarGraph() {
  return (
    <Canvas
      camera={{ position: [0, 0, 70], fov: 60 }}
      style={{ width: '100vw', height: '100vh', background: '#00000f' }}
    >
      <Stars nodes={nodes} />
      <ImportLines nodes={nodes} />
      <CameraControls />
    </Canvas>
  )
}
