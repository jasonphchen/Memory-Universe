# Memory Universe

```bash
- Dotnet, React, C#, TypeScript, Semantic Kernal
- Three Images per dialog is maximum
```

```bash
http://43.132.123.72
```

```bash
python ts-front/src/assets/compress.py
```

```bash
kill -9 pid

cd Memory-Universe
git fetch origin
git reset --hard origin/main
cd dotnet_back

echo "[4/6] Building release version"
dotnet publish -c Release

echo "[5/6] Navigating to publish directory"
cd bin/Release/net9.0

echo "[6/6] Starting application in background"
export DOTNET_ENVIRONMENT=Release
nohup dotnet dotnet_back.dll > output.log 2>&1 &
```

```bash
cd /home/ubuntu/Memory-Universe/dotnet_back/bin/Release/net9.0
```

```bash
sudo apt install -y ffmpeg
```