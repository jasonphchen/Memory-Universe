namespace Dotnet_back.Models.ContentEntity;

public class MemoryContent
{
    public required string Id { get; set; }
    public required string Title { get; set; }
    public string? Content { get; set; }
    public DateOnly Time { get; set; }
    public string? Location { get; set; }
    public List<MemoryPhoto> Photos { get; set; } = new();
    public List<MemoryAudio> Audios { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class MemoryPhoto
{
    public required string Id { get; set; }
    public required string Url { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class MemoryAudio
{
    public required string Id { get; set; }
    public required string Url { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
