git submodule init && git submodule update --recursive --init
dotnet build tortuga/Tortuga/Tortuga.csproj
cp tortuga/Tortuga/bin/Debug/netcoreapp3.0/* . && rm -r tortuga
dotnet restore TortugaEditor.csproj