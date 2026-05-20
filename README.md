# Memory Universe
- A memory universe that kept all the precious memories of my family.
- Website: http://memory.jasonphchen.com

## Architecture
- Backend
    - C#, Dotnet
    - Packages
        - AI
            - Semantic Kernal
        - Image Processing and Compression
            - HEIC/HEIF (Apple Photos)
                - ImageMagick
            - Other Images
                - ImageSharp
- Frontend
    - TypeScript, React
    - Packages
        - 3D Rendering
            - three.js
        - Image Metadata Extraction
            - exifr
        - Map
            - leaflet
    - API
        - OpenStreetMap
            - Transform Location to Cooridnate
- Server:
    - Tecent Cloud VM
    - Database
        - MongoDB
    - Web Server
        - Nginx
    - DNS and Domain Registrar
        - CloudFlare
    - HTTPS
        - SSL Certificate & CertBot Auto-update
- AI
    - Azure OpenAI API
        - Models
            - Text: gpt-5.4-mini 
            - Text-to-Audio: gpt-4o-mini-transcribe
    - ElevanLabs API
        - Text to Audio

## Features
    - Responsive (Desktop & Mobile)
    - CRUD Memory
    - Authentication (Register, Login)
    - Image Geolocation Extraction
    - Geolocation Map
    - Multi-Modals AI
        - OpenAI Text Refinement
        - OpenAI Translation
        - OpenAI Transcribe (Speech to Text)
        - ElevalLabs Audio (Text to Speech)

## Compress Image
```bash
pip install Pillow
python ts-front/src/assets/compress.py
```

## Deployment Script
```bash
kill -9 <pid> # Kill the existing dotnet process

cd Memory-Universe
git fetch origin
git reset --hard origin/main
cd dotnet_back
# Move the appsettings.json

dotnet publish -c Release

cd bin/Release/net9.0

export DOTNET_ENVIRONMENT=Release
nohup dotnet dotnet_back.dll > output.log 2>&1 &
```