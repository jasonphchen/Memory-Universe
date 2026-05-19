# Memory Universe

## Features
- Backend
    - C#, Dotnet
    - AI Package
        - Semantic Kernal
- Frontend
    - TypeScript, React
- Database
    - MongoDB
- AI
    - OpenAI API (gpt-5.4-mini, gpt-4o-mini-transcribe)
- Authentication (Register, Login)
- Responsive (Desktop & Mobile)
- CRUD Memory

```bash
- Server: TecentCloud, Nginx
- Dotnet, React, C#, TypeScript, Semantic Kernal
- Three Images per dialog is maximum
```

```bash
http://43.132.123.72

export PATH="/opt/homebrew/opt/dotnet@9/bin:$PATH"
export DOTNET_ROOT="/opt/homebrew/opt/dotnet@9/libexec"
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
Move the appsettings.json

dotnet publish -c Release

cd bin/Release/net9.0

export DOTNET_ENVIRONMENT=Release
nohup dotnet dotnet_back.dll > output.log 2>&1 &
```

```bash
cd /home/ubuntu/Memory-Universe/dotnet_back/bin/Release/net9.0
```

```bash
sudo apt install -y ffmpeg
```