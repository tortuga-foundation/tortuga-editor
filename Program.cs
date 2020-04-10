using System.Threading.Tasks;
using System.Numerics;

namespace TortugaEditor
{
    class Program
    {
        static async Task Main(string[] args)
        {
            //create new scene
            var scene = new Tortuga.Core.Scene();

            //camera
            {
                var entity = new Tortuga.Core.Entity();
                entity.Name = "Camera";
                var camera = await entity.AddComponent<Tortuga.Components.Camera>();
                camera.FieldOfView = 90;
                scene.AddEntity(entity);
            }

            //load obj model
            var sphereOBJ = await Tortuga.Graphics.Mesh.Load("Assets/Models/Sphere.obj");
            //load bricks material
            var bricksMaterial = await Tortuga.Graphics.Material.Load("Assets/Material/Bricks.json");

            //light
            {
                var entity = new Tortuga.Core.Entity();
                entity.Name = "Light";
                var transform = await entity.AddComponent<Tortuga.Components.Transform>();
                transform.Position = new Vector3(0, 0, -7);
                transform.IsStatic = true;
                //add light component
                var light = await entity.AddComponent<Tortuga.Components.Light>();
                light.Intensity = 200.0f;
                light.Type = Tortuga.Components.Light.LightType.Point;
                light.Color = System.Drawing.Color.White;
                scene.AddEntity(entity);
            }

            //sphere 1
            {
                var entity = new Tortuga.Core.Entity();
                entity.Name = "sphere 1";
                var transform = await entity.AddComponent<Tortuga.Components.Transform>();
                transform.Position = new Vector3(0, 0, -10);
                transform.IsStatic = false;
                //add mesh component
                var mesh = await entity.AddComponent<Tortuga.Components.RenderMesh>();
                mesh.Material = bricksMaterial;
                await mesh.SetMesh(sphereOBJ); //this operation is async and might not be done instantly

                scene.AddEntity(entity);
            }

            //sphere 2
            {
                var entity = new Tortuga.Core.Entity();
                entity.Name = "sphere 2";
                var transform = await entity.AddComponent<Tortuga.Components.Transform>();
                transform.Position = new Vector3(3, 0, -10);
                transform.IsStatic = false;
                //add mesh component
                var mesh = await entity.AddComponent<Tortuga.Components.RenderMesh>();
                mesh.Material = bricksMaterial;
                await mesh.SetMesh(sphereOBJ); //this operation is async and might not be done instantly

                scene.AddEntity(entity);
            }

            //user interface
            {
                //create a new ui block element and add it to the scene
                var block = new Tortuga.Graphics.UI.UiBlock();
                scene.AddUserInterface(block);

                //setup block
                block.PositionXConstraint = new Tortuga.Graphics.UI.PercentConstraint(1.0f) - new Tortuga.Graphics.UI.PixelConstraint(310.0f);
                block.PositionYConstraint = new Tortuga.Graphics.UI.PixelConstraint(10.0f);
                block.ScaleXConstraint = new Tortuga.Graphics.UI.PixelConstraint(300.0f);
                block.ScaleYConstraint = new Tortuga.Graphics.UI.PercentConstraint(1.0f) - new Tortuga.Graphics.UI.PixelConstraint(20.0f);
                block.BorderRadius = 20;
                block.Background = System.Drawing.Color.FromArgb(200, 5, 5, 5);

                //create a vertical layout group
                var layout = new Tortuga.Graphics.UI.UiVerticalLayout();
                layout.PositionXConstraint = new Tortuga.Graphics.UI.PixelConstraint(0.0f);
                layout.PositionYConstraint = new Tortuga.Graphics.UI.PixelConstraint(20.0f);
                layout.ScaleXConstraint = new Tortuga.Graphics.UI.PercentConstraint(1.0f) - new Tortuga.Graphics.UI.PixelConstraint(5.0f);
                layout.ScaleYConstraint = new Tortuga.Graphics.UI.ContentAutoFitConstraint();
                layout.Spacing = 0.0f;

                var scrollRect = new Tortuga.Graphics.UI.UiScrollRect();
                scrollRect.PositionXConstraint = new Tortuga.Graphics.UI.PixelConstraint(0.0f);
                scrollRect.PositionYConstraint = new Tortuga.Graphics.UI.PixelConstraint(20.0f);
                scrollRect.ScaleXConstraint = new Tortuga.Graphics.UI.PercentConstraint(1.0f);
                scrollRect.ScaleYConstraint = new Tortuga.Graphics.UI.PercentConstraint(1.0f / 3.0f);
                scrollRect.Viewport = layout;
                block.Add(scrollRect);

                for (int i = 0; i < scene.Entities.Count; i++)
                {
                    int color = i % 2 == 0 ? 10 : 5;

                    var entity = scene.Entities[i];
                    var button = new Tortuga.Graphics.UI.UiButton();
                    button.ScaleXConstraint = new Tortuga.Graphics.UI.PercentConstraint(1.0f);
                    button.ScaleYConstraint = new Tortuga.Graphics.UI.PixelConstraint(40);
                    button.BorderRadius = 0.0f;
                    button.Text.FontSize = 10.0f;
                    button.Text.HorizontalAlignment = Tortuga.Graphics.UI.UiHorizontalAlignment.Left;
                    button.Text.PositionXConstraint = new Tortuga.Graphics.UI.PixelConstraint(10.0f);
                    button.Text.ScaleXConstraint = new Tortuga.Graphics.UI.PercentConstraint(1.0f) - new Tortuga.Graphics.UI.PixelConstraint(20.0f);
                    button.Text.Text = entity.Name;
                    button.Text.TextColor = System.Drawing.Color.White;
                    button.NormalBackground = System.Drawing.Color.FromArgb(255, color, color, color);
                    button.HoverBackground = System.Drawing.Color.FromArgb(255, 50, 50, 50);
                    layout.Add(button);
                }
            }

            //add systems to the scene
            scene.AddSystem<Tortuga.Systems.RenderingSystem>();

            Tortuga.Engine.Instance.LoadScene(scene); //set this scene as currently active
            await Tortuga.Engine.Instance.Run();
        }
    }
}
