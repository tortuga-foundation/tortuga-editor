using Tortuga;
using Tortuga.Core;
using Tortuga.Components;
using Tortuga.Systems;
using Tortuga.Utils;
using System.Drawing;
using System.Numerics;
using System.Threading.Tasks;

namespace tortuga_editor
{
    class Program
    {
        static async Task Main(string[] args)
        {
            var engine = new Engine();

            //create new scene
            var scene = new Scene();

            //camera
            var camera = new Entity();
            await camera.AddComponent<Camera>();
            scene.AddEntity(camera);

            //load obj model
            var cube = new OBJLoader("Assets/Models/Monkey.obj");

            //light
            var light = new Entity();
            var lTransform = await light.AddComponent<Transform>();
            lTransform.Position = new Vector3(0, 5, -10);
            var lComp = await light.AddComponent<Light>();
            lComp.Intensity = 1.0f;
            lComp.Range = 1.0f;
            lComp.Type = Light.LightType.Point;
            lComp.Color = Color.White;
            scene.AddEntity(light);

            //entity
            var triangle = new Entity();
            var transform = await triangle.AddComponent<Transform>();
            transform.Position = new Vector3(0, 0, -10);
            transform.IsStatic = false;
            var mesh = await triangle.AddComponent<Mesh>();
            scene.AddEntity(triangle);
            await mesh.SetVertices(cube.ToGraphicsVertices);
            await mesh.SetIndices(cube.ToGraphicsIndex);

            scene.AddSystem<RenderingSystem>();

            //user interface test
            {
                var userInterface = new Entity();
                var uTransform = await userInterface.AddComponent<Transform>();
                uTransform.Scale = Vector3.One * 0.1f;
                var ui = await userInterface.AddComponent<UserInterface>();
                scene.AddEntity(userInterface);
            }

            engine.LoadScene(scene);
            await engine.Run();
        }
    }
}
