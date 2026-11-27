// GLB yükleyici: Blender modelleri meshopt ile sıkıştırılmıştır (tools/blender/export_assets.py + gltf-transform meshopt).
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const makeLoader = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
