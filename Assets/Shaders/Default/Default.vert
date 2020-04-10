#version 460

layout(set=0, binding=0) readonly uniform CAMERA_MVP
{
    mat4 view;
    mat4 projection;
    int cameraX;
    int cameraY;
    int cameraWidth;
    int cameraHeight;
};
layout(set=1, binding=0) readonly uniform MESH_MVP
{
    mat4 model;
};
layout(set=3, binding=0) readonly uniform MATERIAL_INFO
{
    int workflow;
};

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec2 inUV;
layout(location = 2) in vec3 inNormal;

layout(location = 0) out vec3 outNormal;
layout(location = 1) out vec2 outUV;
layout(location = 2) out vec3 outCameraPosition;
layout(location = 3) out vec3 outWorldPosition;

void main() {
    vec4 worldPosition = model * vec4(inPosition, 1.0);

    gl_Position = projection * view * worldPosition;

    outWorldPosition = worldPosition.xyz;
    outUV = inUV;
    outCameraPosition = inverse(view)[3].xyz;
    outNormal = normalize(model * vec4(inNormal, 0.)).xyz;
}