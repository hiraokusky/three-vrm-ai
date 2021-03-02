import React from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRM, VRMSchema } from '@pixiv/three-vrm';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export default class AIAvatar extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            canvas: null
        };
    }
    
    onCanvasLoaded = (canvas) => {
        if (!canvas) {
            return;
        }

        this.setState({ canvas: canvas });

        // renderer
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: !this.props.debug ? true : false });
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        // camera
        const camera = new THREE.PerspectiveCamera(30.0, canvas.clientWidth / canvas.clientHeight, 0.1, 50.0);
        camera.position.set(0.0, 0.0, 10.0);

        // camera controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.screenSpacePanning = true;
        controls.target.set(0.0, 0.0, 0.0);
        controls.update();

        // scene
        const scene = new THREE.Scene();

        // light
        const light = new THREE.DirectionalLight(0xffffff);
        light.position.set(1.0, 1.0, 1.0).normalize();
        scene.add(light);

        let currentVrm = undefined;
        const loader = new GLTFLoader();
        loader.load(

            // URL of the VRM you want to load
            '/vrm/three-vrm-girl.vrm',

            // called when the resource is loaded
            (gltf) => {

                // generate a VRM instance from gltf
                VRM.from(gltf).then((vrm) => {

                    console.log(vrm);

                    // add the loaded vrm to the scene
                    scene.add(vrm.scene);
                    currentVrm = vrm;

                    // カメラの方を向く
                    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips).rotation.y = Math.PI;

                    // -X象限に移動
                    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.x = -1;
                });

            },

            // called while loading is progressing
            (progress) => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),

            // called when loading has errors
            (error) => console.error(error)

        );

        if (this.props.debug) {
            // helpers
            const gridHelper = new THREE.GridHelper(10, 10);
            scene.add(gridHelper);

            const axesHelper = new THREE.AxesHelper(5);
            scene.add(axesHelper);
        }

        // animate
        const clock = new THREE.Clock();
        let vx = -0.01;

        function animate() {

            requestAnimationFrame(animate);

            const deltaTime = clock.getDelta();

            if (currentVrm) {

                // move
                let px = currentVrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.x;
                let py = currentVrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.y;
                let pz = currentVrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.z;

                px += vx;
                if (px < -5 || px > 0) {
                    vx = -vx;
                }
                currentVrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips).position.set(px, py, pz);

                // bones
                const s = 0.45 * Math.PI * Math.sin(Math.PI * clock.elapsedTime);
                currentVrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips).rotation.y = s * 2;
                currentVrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.LeftUpperArm).rotation.z = s;
                currentVrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.RightUpperArm).rotation.z = -s;

                // blend shapes
                currentVrm.blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Fun, .7);
                currentVrm.blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Sorrow, .2);
                currentVrm.blendShapeProxy.update();

                // update vrm
                currentVrm.update(deltaTime);

            }

            renderer.render(scene, camera);
        }

        animate();
    };

    render() {
        return (
            <canvas id="canvas"
                style={{
                    pointerEvents: this.props.debug ? "auto" : "none",
                    zIndex: "999",
                    position: "fixed",
                    bottom: this.state.canvas ? -this.state.canvas.clientHeight / 2 + "px" : "0px",
                    right: this.state.canvas ? -this.state.canvas.clientWidth / 2 + "px" : "0px",
                    width: "200vw",
                    height: "200vh"
                }}
                ref={this.onCanvasLoaded} />
        );
    }
}