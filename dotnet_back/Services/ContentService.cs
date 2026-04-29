using Dotnet_back.Models.ContentEntity;
using Microsoft.AspNetCore.Http;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Diagnostics;
using ImageMagick;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace Dotnet_back.Services.ContentService;

public class ContentService
{
    private readonly IMongoCollection<MemoryContent> _memoryCollection;
    private readonly string _uploadsRoot;
    private readonly string _photosRoot;
    private readonly string _audiosRoot;
    private readonly string _tempRoot;
    private readonly string _uploadsPublicBase;
    private readonly long _photoCompressionThresholdBytes;
    private readonly int _photoMaxWidth;
    private readonly int _photoJpegQuality;
    private readonly int _audioBitrateKbps;

    public ContentService(IMongoClient mongoClient, IConfiguration configuration, IWebHostEnvironment environment)
    {
        var databaseName = configuration["MongoDB:DatabaseName"] ?? "memory_universe";
        var collectionName = configuration["MongoDB:MemoryCollectionName"] ?? "memories";
        var database = mongoClient.GetDatabase(databaseName);
        _memoryCollection = database.GetCollection<MemoryContent>(collectionName);

        var webRootPath = environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRootPath))
        {
            webRootPath = Path.Combine(environment.ContentRootPath, "wwwroot");
        }

        _uploadsPublicBase = (configuration["Media:PublicBaseUrl"] ?? "/uploads").TrimEnd('/');
        _uploadsRoot = Path.Combine(webRootPath, "uploads");
        _photosRoot = Path.Combine(_uploadsRoot, "photos");
        _audiosRoot = Path.Combine(_uploadsRoot, "audios");
        _tempRoot = Path.Combine(_uploadsRoot, "tmp");

        Directory.CreateDirectory(_photosRoot);
        Directory.CreateDirectory(_audiosRoot);
        Directory.CreateDirectory(_tempRoot);

        _photoCompressionThresholdBytes = configuration.GetValue<long?>("Media:PhotoCompressionThresholdBytes") ?? 1_000_000;
        _photoMaxWidth = configuration.GetValue<int?>("Media:PhotoMaxWidth") ?? 1920;
        _photoJpegQuality = configuration.GetValue<int?>("Media:PhotoJpegQuality") ?? 75;
        _audioBitrateKbps = configuration.GetValue<int?>("Media:AudioBitrateKbps") ?? 24;
    }

    public async Task<MemoryContent> CreateAsync(MemoryContent memory)
    {
        memory.Id = ObjectId.GenerateNewId().ToString();
        memory.CreatedAt = DateTime.UtcNow;
        memory.UpdatedAt = DateTime.UtcNow;

        await _memoryCollection.InsertOneAsync(memory);
        return memory;
    }

    public async Task<List<MemoryContent>> GetAllAsync()
    {
        return await _memoryCollection
            .Find(_ => true)
            .SortByDescending(x => x.Time)
            .ToListAsync();
    }

    public async Task<MemoryContent?> GetByIdAsync(string id)
    {
        return await _memoryCollection.Find(x => x.Id == id).FirstOrDefaultAsync();
    }

    public async Task<(bool MemoryExists, MemoryPhoto? Photo)> GetPhotoByIdAsync(string memoryId, string photoId)
    {
        var memory = await _memoryCollection.Find(x => x.Id == memoryId).FirstOrDefaultAsync();
        if (memory is null)
        {
            return (false, null);
        }

        var photo = memory.Photos.FirstOrDefault(x => x.Id == photoId);
        return (true, photo);
    }

    public async Task<(bool MemoryExists, MemoryAudio? Audio)> GetAudioByIdAsync(string memoryId, string audioId)
    {
        var memory = await _memoryCollection.Find(x => x.Id == memoryId).FirstOrDefaultAsync();
        if (memory is null)
        {
            return (false, null);
        }

        var audio = memory.Audios.FirstOrDefault(x => x.Id == audioId);
        return (true, audio);
    }

    public async Task<bool> UpdateAsync(string id, string title, string content, DateOnly time, string location)
    {
        var update = Builders<MemoryContent>.Update
            .Set(x => x.Title, title)
            .Set(x => x.Content, content)
            .Set(x => x.Time, time)
            .Set(x => x.Location, location)
            .Set(x => x.UpdatedAt, DateTime.UtcNow);

        var result = await _memoryCollection.UpdateOneAsync(x => x.Id == id, update);
        return result.MatchedCount > 0;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _memoryCollection.DeleteOneAsync(x => x.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<MemoryPhoto?> AddPhotoAsync(string memoryId, string url)
    {
        var photo = new MemoryPhoto
        {
            Id = ObjectId.GenerateNewId().ToString(),
            Url = url.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        var update = Builders<MemoryContent>.Update
            .Push(x => x.Photos, photo)
            .Set(x => x.UpdatedAt, DateTime.UtcNow);

        var result = await _memoryCollection.UpdateOneAsync(x => x.Id == memoryId, update);
        return result.MatchedCount > 0 ? photo : null;
    }

    public async Task<MemoryAudio?> AddAudioAsync(string memoryId, string url)
    {
        var audio = new MemoryAudio
        {
            Id = ObjectId.GenerateNewId().ToString(),
            Url = url.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        var update = Builders<MemoryContent>.Update
            .Push(x => x.Audios, audio)
            .Set(x => x.UpdatedAt, DateTime.UtcNow);

        var result = await _memoryCollection.UpdateOneAsync(x => x.Id == memoryId, update);
        return result.MatchedCount > 0 ? audio : null;
    }

    public async Task<(string? Url, string? Error)> SavePhotoAsync(IFormFile photo, CancellationToken cancellationToken = default)
    {
        if (photo.Length <= 0)
        {
            return (null, "Photo file is empty.");
        }

        var sourceExtension = NormalizeExtension(Path.GetExtension(photo.FileName), ".jpg");
        if (!IsAllowedPhotoExtension(sourceExtension))
        {
            return (null, "Unsupported photo format.");
        }

        var tempInputPath = Path.Combine(_tempRoot, $"{Guid.NewGuid():N}{sourceExtension}");
        await using (var stream = File.Create(tempInputPath))
        {
            await photo.CopyToAsync(stream, cancellationToken);
        }

        try
        {
            var shouldTranscodeToJpeg = photo.Length > _photoCompressionThresholdBytes || sourceExtension is ".heic" or ".heif";
            if (shouldTranscodeToJpeg)
            {
                var compressedName = $"{Guid.NewGuid():N}.jpg";
                var compressedPath = Path.Combine(_photosRoot, compressedName);
                var (success, error) = await CompressPhotoToJpegAsync(
                    tempInputPath,
                    compressedPath,
                    sourceExtension is ".heic" or ".heif",
                    cancellationToken
                );
                if (!success)
                {
                    return (null, $"Photo compression failed: {error}");
                }

                return ($"{_uploadsPublicBase}/photos/{compressedName}", null);
            }

            var outputName = $"{Guid.NewGuid():N}{sourceExtension}";
            var outputPath = Path.Combine(_photosRoot, outputName);
            File.Move(tempInputPath, outputPath, overwrite: true);
            tempInputPath = string.Empty;
            return ($"{_uploadsPublicBase}/photos/{outputName}", null);
        }
        finally
        {
            if (!string.IsNullOrWhiteSpace(tempInputPath) && File.Exists(tempInputPath))
            {
                File.Delete(tempInputPath);
            }
        }
    }

    private async Task<(bool Success, string? Error)> CompressPhotoToJpegAsync(
        string inputPath,
        string outputPath,
        bool isHeicOrHeif,
        CancellationToken cancellationToken)
    {
        try
        {
            if (isHeicOrHeif)
            {
                using var magickImage = new MagickImage(inputPath);
                magickImage.AutoOrient();
                var maxWidth = (uint)Math.Max(1, _photoMaxWidth);
                if (magickImage.Width > maxWidth)
                {
                    magickImage.Resize(maxWidth, 0);
                }

                magickImage.Format = MagickFormat.Jpeg;
                magickImage.Quality = (uint)Math.Clamp(_photoJpegQuality, 1, 100);
                magickImage.Write(outputPath);
                return (true, null);
            }

            await using var inputStream = File.OpenRead(inputPath);
            using var image = await Image.LoadAsync(inputStream, cancellationToken);
            image.Mutate(x =>
            {
                x.AutoOrient();
                if (image.Width > _photoMaxWidth)
                {
                    x.Resize(new ResizeOptions
                    {
                        Size = new Size(_photoMaxWidth, 0),
                        Mode = ResizeMode.Max
                    });
                }
            });

            var encoder = new JpegEncoder
            {
                Quality = Math.Clamp(_photoJpegQuality, 1, 100)
            };
            await image.SaveAsJpegAsync(outputPath, encoder, cancellationToken);
            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(string? Url, string? Error)> SaveAudioAsync(IFormFile audio, CancellationToken cancellationToken = default)
    {
        if (audio.Length <= 0)
        {
            return (null, "Audio file is empty.");
        }

        var sourceExtension = NormalizeExtension(Path.GetExtension(audio.FileName), ".bin");
        if (!IsAllowedAudioExtension(sourceExtension))
        {
            return (null, "Unsupported audio format.");
        }

        var tempInputPath = Path.Combine(_tempRoot, $"{Guid.NewGuid():N}{sourceExtension}");
        await using (var stream = File.Create(tempInputPath))
        {
            await audio.CopyToAsync(stream, cancellationToken);
        }

        var outputName = $"{Guid.NewGuid():N}.webm";
        var outputPath = Path.Combine(_audiosRoot, outputName);

        try
        {
            var (success, error) = await TranscodeAudioToOpusAsync(tempInputPath, outputPath, sourceExtension, cancellationToken);
            if (!success)
            {
                return (null, $"Audio compression failed: {error}");
            }

            return ($"{_uploadsPublicBase}/audios/{outputName}", null);
        }
        finally
        {
            if (File.Exists(tempInputPath))
            {
                File.Delete(tempInputPath);
            }
        }
    }

    public async Task<(bool MemoryExists, bool Deleted)> DeletePhotoAsync(string memoryId, string photoId)
    {
        var memory = await _memoryCollection.Find(x => x.Id == memoryId).FirstOrDefaultAsync();
        if (memory is null)
        {
            return (false, false);
        }

        var existingPhoto = memory.Photos.FirstOrDefault(x => x.Id == photoId);
        if (existingPhoto is null)
        {
            return (true, false);
        }

        var update = Builders<MemoryContent>.Update
            .PullFilter(x => x.Photos, x => x.Id == photoId)
            .Set(x => x.UpdatedAt, DateTime.UtcNow);

        var result = await _memoryCollection.UpdateOneAsync(x => x.Id == memoryId, update);
        if (result.ModifiedCount == 0)
        {
            return (true, false);
        }

        DeletePhysicalFileFromUrl(existingPhoto.Url);
        return (true, true);
    }

    public async Task<(bool MemoryExists, bool Deleted)> DeleteAudioAsync(string memoryId, string audioId)
    {
        var memory = await _memoryCollection.Find(x => x.Id == memoryId).FirstOrDefaultAsync();
        if (memory is null)
        {
            return (false, false);
        }

        var existingAudio = memory.Audios.FirstOrDefault(x => x.Id == audioId);
        if (existingAudio is null)
        {
            return (true, false);
        }

        var update = Builders<MemoryContent>.Update
            .PullFilter(x => x.Audios, x => x.Id == audioId)
            .Set(x => x.UpdatedAt, DateTime.UtcNow);

        var result = await _memoryCollection.UpdateOneAsync(x => x.Id == memoryId, update);
        if (result.ModifiedCount == 0)
        {
            return (true, false);
        }

        DeletePhysicalFileFromUrl(existingAudio.Url);
        return (true, true);
    }

    private void DeletePhysicalFileFromUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return;
        }

        try
        {
            var pathFromUrl = url;
            if (Uri.TryCreate(url, UriKind.Absolute, out var absoluteUri))
            {
                pathFromUrl = absoluteUri.LocalPath;
            }

            pathFromUrl = pathFromUrl.Replace('\\', '/');
            var expectedPrefix = $"{_uploadsPublicBase}/";
            if (!pathFromUrl.StartsWith(expectedPrefix, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var relativePath = pathFromUrl[expectedPrefix.Length..].TrimStart('/');
            var fullPath = Path.GetFullPath(Path.Combine(_uploadsRoot, relativePath));
            var uploadsRootFullPath = Path.GetFullPath(_uploadsRoot);

            if (!fullPath.StartsWith(uploadsRootFullPath, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
            }
        }
        catch
        {
            // No-op: media metadata deletion should not fail because file cleanup fails.
        }
    }

    private static async Task<(bool Success, string Error)> RunProcessAsync(
        string fileName,
        string arguments,
        CancellationToken cancellationToken)
    {
        try
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = arguments,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            process.Start();
            var stdOutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
            var stdErrTask = process.StandardError.ReadToEndAsync(cancellationToken);

            await process.WaitForExitAsync(cancellationToken);
            var stdOut = await stdOutTask;
            var stdErr = await stdErrTask;

            if (process.ExitCode != 0)
            {
                var error = string.IsNullOrWhiteSpace(stdErr) ? stdOut : stdErr;
                return (false, error.Trim());
            }

            return (true, string.Empty);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    private static string NormalizeExtension(string extension, string fallback)
    {
        if (string.IsNullOrWhiteSpace(extension))
        {
            return fallback;
        }

        var normalized = extension.Trim().ToLowerInvariant();
        return normalized.StartsWith('.') ? normalized : $".{normalized}";
    }

    private static bool IsAllowedPhotoExtension(string extension)
    {
        return extension is ".jpg" or ".jpeg" or ".png" or ".webp" or ".heic" or ".heif";
    }

    private static bool IsAllowedAudioExtension(string extension)
    {
        return extension is ".mp3" or ".wav" or ".m4a" or ".ogg" or ".webm";
    }

    private async Task<(bool Success, string Error)> TranscodeAudioToOpusAsync(
        string inputPath,
        string outputPath,
        string sourceExtension,
        CancellationToken cancellationToken)
    {
        var commonOutputArgs = $"-vn -c:a libopus -b:a {_audioBitrateKbps}k -ac 1 -ar 16000 \"{outputPath}\"";

        var candidates = new List<string>
        {
            $"-y -i \"{inputPath}\" {commonOutputArgs}"
        };

        if (sourceExtension == ".amr")
        {
            candidates.Add($"-y -f amr -i \"{inputPath}\" {commonOutputArgs}");
        }
        else if (sourceExtension == ".silk")
        {
            candidates.Add($"-y -f silk -i \"{inputPath}\" {commonOutputArgs}");
        }

        var errors = new List<string>();
        foreach (var args in candidates)
        {
            var (success, error) = await RunProcessAsync("ffmpeg", args, cancellationToken);
            if (success)
            {
                return (true, string.Empty);
            }

            errors.Add(error);
        }

        return (false, string.Join(" | ", errors.Where(x => !string.IsNullOrWhiteSpace(x))));
    }
}
