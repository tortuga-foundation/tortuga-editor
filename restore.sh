git clone https://github.com/tortuga-foundation/tortuga.git
dotnet build tortuga/Tortuga/Tortuga.csproj
cp tortuga/Tortuga/bin/Debug/netcoreapp3.0/* . 
rm -rf tortuga
dotnet restore TortugaEditor.csproj