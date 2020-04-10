#version 460
#extension GL_ARB_separate_shader_objects : enable

struct LightInfo
{
    vec4 position;
    vec4 forward;
    vec4 color;
    int type;
    float intensity;
    int reserved1;
    int reserved2;
};
layout(set=2, binding=0) readonly uniform LIGHT_SHADER_INFO
{
    LightInfo info[10];
    int lightsCount;
} lightData;
layout(set=3, binding=0) readonly uniform MATERIAL_INFO
{
    int workflow;
};

layout(set=4, binding=0) uniform sampler2D albedoTexture;
layout(set=4, binding=1) uniform sampler2D normalTexture;
layout(set=4, binding=2) uniform sampler2D physicalDescriptorTexture;

layout(location = 0) in vec3 inNormal;
layout(location = 1) in vec2 inUV;
layout(location = 2) in vec3 inCameraPosition;
layout(location = 3) in vec3 inWorldPosition;

layout(location = 0) out vec4 outColor;


// Encapsulate the various inputs used by the various functions in the shading equation
// We store values in this struct to simplify the integration of alternative implementations
// of the shading terms, outlined in the Readme.MD Appendix.
struct PBRInfo
{
	float NdotL;                  // cos angle between normal and light direction
	float NdotV;                  // cos angle between normal and view direction
	float NdotH;                  // cos angle between normal and half vector
	float LdotH;                  // cos angle between light direction and half vector
	float VdotH;                  // cos angle between view direction and half vector
	float roughness;    // roughness value, as authored by the model creator (input to shader)
	float metalness;              // metallic value at the surface
	vec3 reflectance0;            // full reflectance color (normal incidence angle)
	vec3 reflectance90;           // reflectance color at grazing angle
	float alphaRoughness;         // roughness mapped to a more linear change in the roughness (proposed by [2])
	vec3 diffuseColor;            // color contribution from diffuse lighting
	vec3 specularColor;           // color contribution from specular lighting
};

const float PI = 3.141592653589793;
const float MIN_ROUGHNESS = 0.04;
#define MANUAL_SRGB 1

vec3 Uncharted2Tonemap(vec3 color)
{
	float A = 0.15;
	float B = 0.50;
	float C = 0.10;
	float D = 0.20;
	float E = 0.02;
	float F = 0.30;
	float W = 11.2;
	return ((color*(A*color+C*B)+D*E)/(color*(A*color+B)+D*F))-E/F;
}

vec4 Tonemap(vec4 color)
{
	vec3 outcol = Uncharted2Tonemap(color.rgb * 1);
	outcol = outcol * (1.0f / Uncharted2Tonemap(vec3(11.2f)));	
	return vec4(pow(outcol, vec3(1.0f / 1)), color.a);
}

vec4 SRGBtoLINEAR(vec4 srgbIn)
{
	#ifdef MANUAL_SRGB
	#ifdef SRGB_FAST_APPROXIMATION
	vec3 linOut = pow(srgbIn.xyz,vec3(2.2));
	#else //SRGB_FAST_APPROXIMATION
	vec3 bLess = step(vec3(0.04045),srgbIn.xyz);
	vec3 linOut = mix( srgbIn.xyz/vec3(12.92), pow((srgbIn.xyz+vec3(0.055))/vec3(1.055),vec3(2.4)), bLess );
	#endif //SRGB_FAST_APPROXIMATION
	return vec4(linOut,srgbIn.w);;
	#else //MANUAL_SRGB
	return srgbIn;
	#endif //MANUAL_SRGB
}
vec3 GetNormal(mat3 TBN)
{
    vec3 tangentNormal = texture(normalTexture, inUV).rgb;
    return normalize(TBN * tangentNormal);
}

// Calculation of the lighting contribution from an optional Image Based Light source.
// Precomputed Environment Maps are required uniform inputs and are computed as outlined in [1].
// See our README.md on Environment Maps [3] for additional discussion.
vec3 GetIBLContribution(PBRInfo pbrInputs, vec3 n, vec3 reflection)
{
	// retrieve a scale and bias to F0. See [1], Figure 3
	vec3 brdf = vec3(0.).rgb;
	vec3 diffuseLight = SRGBtoLINEAR(Tonemap(vec4(0.))).rgb;

	vec3 specularLight = SRGBtoLINEAR(Tonemap(vec4(0.))).rgb;

	vec3 diffuse = diffuseLight * pbrInputs.diffuseColor;
	vec3 specular = specularLight * (pbrInputs.specularColor * brdf.x + brdf.y);

	// For presentation, this allows us to disable IBL terms
	// For presentation, this allows us to disable IBL terms
	diffuse *= 1;
	specular *= 1;

	return diffuse + specular;
}

// Basic Lambertian diffuse
// Implementation from Lambert's Photometria https://archive.org/details/lambertsphotome00lambgoog
// See also [1], Equation 1
vec3 Diffuse(PBRInfo pbrInputs)
{
	return pbrInputs.diffuseColor / PI;
}

// The following equation models the Fresnel reflectance term of the spec equation (aka F())
// Implementation of fresnel from [4], Equation 15
vec3 SpecularReflection(PBRInfo pbrInputs)
{
	return pbrInputs.reflectance0 + (pbrInputs.reflectance90 - pbrInputs.reflectance0) * pow(clamp(1.0 - pbrInputs.VdotH, 0.0, 1.0), 5.0);
}

// This calculates the specular geometric attenuation (aka G()),
// where rougher material will reflect less light back to the viewer.
// This implementation is based on [1] Equation 4, and we adopt their modifications to
// alphaRoughness as input as originally proposed in [2].
float GeometricOcclusion(PBRInfo pbrInputs)
{
	float NdotL = pbrInputs.NdotL;
	float NdotV = pbrInputs.NdotV;
	float r = pbrInputs.alphaRoughness;

	float attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
	float attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
	return attenuationL * attenuationV;
}

// The following equation(s) model the distribution of microfacet normals across the area being drawn (aka D())
// Implementation from "Average Irregularity Representation of a Roughened Surface for Ray Reflection" by T. S. Trowbridge, and K. P. Reitz
// Follows the distribution function recommended in the SIGGRAPH 2013 course notes from EPIC Games [1], Equation 3.
float MicrofacetDistribution(PBRInfo pbrInputs)
{
	float roughnessSq = pbrInputs.alphaRoughness * pbrInputs.alphaRoughness;
	float f = (pbrInputs.NdotH * roughnessSq - pbrInputs.NdotH) * pbrInputs.NdotH + 1.0;
	return roughnessSq / (PI * f * f);
}

// Gets metallic factor from specular glossiness workflow inputs 
float ConvertMetallic(vec3 diffuse, vec3 specular, float maxSpecular) {
	float perceivedDiffuse = sqrt(0.299 * diffuse.r * diffuse.r + 0.587 * diffuse.g * diffuse.g + 0.114 * diffuse.b * diffuse.b);
	float perceivedSpecular = sqrt(0.299 * specular.r * specular.r + 0.587 * specular.g * specular.g + 0.114 * specular.b * specular.b);
	if (perceivedSpecular < MIN_ROUGHNESS)
		return 0.0;
	float a = MIN_ROUGHNESS;
	float b = perceivedDiffuse * (1.0 - maxSpecular) / (1.0 - MIN_ROUGHNESS) + perceivedSpecular - 2.0 * MIN_ROUGHNESS;
	float c = MIN_ROUGHNESS - perceivedSpecular;
	float D = max(b * b - 4.0 * a * c, 0.0);
	return clamp((-b + sqrt(D)) / (2.0 * a), 0.0, 1.0);
}

mat3 GetTBN()
{
    vec3 q1  = dFdx(inWorldPosition);
    vec3 q2  = dFdy(inWorldPosition);
    vec2 st1 = dFdx(inUV);
    vec2 st2 = dFdy(inUV);

    vec3 N   = normalize(inNormal);
    vec3 T  = normalize(q1 * st2.t - q2 * st1.t);
    vec3 B  = -normalize(cross(N, T));
    mat3 TBN = mat3(T, B, N);
    return TBN;
}

void main() {
    vec4 baseColor;
    vec3 diffuseColor;
    float metallic;
    float roughness;

    vec3 f0 = vec3(0.04);

    mat3 TBN = GetTBN();
    vec3 n = GetNormal(TBN);
    // Vector from surface point to camera
    vec3 v = normalize(inCameraPosition - inWorldPosition);

    //metalness workflow
    if (workflow == 0)
    {
        roughness = clamp(texture(physicalDescriptorTexture, inUV).g, MIN_ROUGHNESS, 1.);
        metallic = clamp(texture(physicalDescriptorTexture, inUV).r, 0., 1.);
        baseColor = SRGBtoLINEAR(texture(albedoTexture, inUV));
    }
    else if (workflow == 1)
    {
        roughness = 1. - texture(physicalDescriptorTexture, inUV).g;
        const float epsilon = 1e-6;
        vec4 diffuse = SRGBtoLINEAR(texture(albedoTexture, inUV));
		vec3 specular = SRGBtoLINEAR(texture(physicalDescriptorTexture, inUV)).rgb;
        float maxSpecular = max(max(specular.r, specular.g), specular.b);
		// Convert metallic value from specular glossiness inputs
		metallic = ConvertMetallic(diffuse.rgb, specular, maxSpecular);
        vec3 baseColorDiffusePart = diffuse.rgb * ((1.0 - maxSpecular) / (1 - MIN_ROUGHNESS) / max(1 - metallic, epsilon));
		vec3 baseColorSpecularPart = specular - (vec3(MIN_ROUGHNESS) * (1 - metallic) * (1 / max(metallic, epsilon)));
		baseColor = vec4(mix(baseColorDiffusePart, baseColorSpecularPart, metallic * metallic), diffuse.a);
    }

    //get diffuse color
    diffuseColor = baseColor.rgb * (vec3(1.) - f0);
    diffuseColor *= 1. - metallic;

    float alphaRoughness = roughness * roughness;

    vec3 specularColor = mix(f0, baseColor.rgb, metallic);

    //compute reflectance
    float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);

    vec3 totalColor = vec3(0.);
    for (int i = 0; i < lightData.lightsCount; i++)
    {
        LightInfo light = lightData.info[i];

        // For typical incident reflectance range (between 4% to 100%) set the grazing reflectance to 100% for typical fresnel effect.
        // For very low reflectance range on highly diffuse objects (below 4%), incrementally reduce grazing reflecance to 0%.
        float reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
        vec3 specularEnvironmentR0 = specularColor.rgb;
        vec3 specularEnvironmentR90 = vec3(1.0, 1.0, 1.0) * reflectance90;

        vec3 l = normalize(light.position.xyz - inWorldPosition);     // Vector from surface point to light
        if (light.type == 1)
            l = normalize(light.forward.xyz);
        vec3 h = normalize(l+v);                        // Half vector between both l and v
        vec3 reflection = -normalize(reflect(v, n));
        float distance = length(light.position.xyz - inWorldPosition);
        if (light.type == 1)
            distance = 1;
        reflection.y *= -1.0f;

        float NdotL = clamp(dot(n, l), 0.001, 1.0);
        float NdotV = clamp(abs(dot(n, v)), 0.001, 1.0);
        float NdotH = clamp(dot(n, h), 0.0, 1.0);
        float LdotH = clamp(dot(l, h), 0.0, 1.0);
        float VdotH = clamp(dot(v, h), 0.0, 1.0);

        PBRInfo pbrInputs = PBRInfo(
            NdotL,
            NdotV,
            NdotH,
            LdotH,
            VdotH,
            roughness,
            metallic,
            specularEnvironmentR0,
            specularEnvironmentR90,
            alphaRoughness,
            diffuseColor,
            specularColor
        );

        // Calculate the shading terms for the microfacet specular shading model
        vec3 F = SpecularReflection(pbrInputs);
        float G = GeometricOcclusion(pbrInputs);
        float D = MicrofacetDistribution(pbrInputs);

        // Calculation of analytical lighting contribution
        vec3 diffuseContrib = (1.0 - F) * Diffuse(pbrInputs);
        vec3 specContrib = F * G * D / (4.0 * NdotL * NdotV);
        // Obtain final intensity as reflectance (BRDF) scaled by the energy of the light (cosine law)
        vec3 color = (NdotL * light.color.rgb * (diffuseContrib + specContrib) * light.intensity) / (distance * distance);

        // Calculate lighting contribution from image based lighting source (IBL)
        color += GetIBLContribution(pbrInputs, n, reflection);

        float ao = texture(physicalDescriptorTexture, inUV).b;
        color = mix(color, color * ao, 1.);

        //vec3 emissive = SRGBtoLINEAR(texture(emissiveTexture, inUV).rgb);
        //color += emissive;

        totalColor += color;
    }

    outColor = vec4(totalColor, baseColor.a);
}