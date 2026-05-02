using Microsoft.Extensions.DependencyInjection;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using MagickException = ImageMagick.MagickException;
using MagickFormat = ImageMagick.MagickFormat;
using MagickImage = ImageMagick.MagickImage;

namespace Dotnet_back.Chatbot;

public class ChatbotRequest
{
    public string Message { get; set; } = string.Empty;
    public string? SystemPrompt { get; set; }
}

public class ChatbotImageRequest
{
    public string? Message { get; set; }
    public string? SystemPrompt { get; set; }
    public List<ChatbotImageInput>? Images { get; set; }
}

public class ChatbotImageInput
{
    public string Base64 { get; set; } = string.Empty;
    public string ImageType { get; set; } = string.Empty;
}

public class ChatbotAudioRequest
{
    public string Message { get; set; } = string.Empty;
    public string? SystemPrompt { get; set; }
    public List<ChatbotAudioInput> Audios { get; set; } = [];
}

public class ChatbotAudioInput
{
    public string Base64 { get; set; } = string.Empty;
    public string AudioType { get; set; } = string.Empty;
}

public record ChatbotResponse(string Reply, string Model);

public class ChatbotService
{
    private const string Model = "gpt-5.4-mini";
    private const string DefaultSystemPrompt = "你是一个中文记忆助手，请根据用户输入提供自然、准确、简洁的回复。";

    private readonly Kernel _kernel;
    private readonly IChatCompletionService _chatCompletionService;

    public ChatbotService(IConfiguration configuration)
    {
        var apiKey = configuration["OpenAI:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("尚未配置 OpenAI API 密钥。");
        }

        _kernel = Kernel.CreateBuilder()
            .AddOpenAIChatCompletion(Model, apiKey)
            .Build();

        _chatCompletionService = _kernel.Services.GetRequiredService<IChatCompletionService>();
    }

    public async Task<ChatbotResponse> GetReplyAsync(ChatbotRequest request, CancellationToken cancellationToken = default)
    {
        var history = new ChatHistory();
        history.AddSystemMessage(
            string.IsNullOrWhiteSpace(request.SystemPrompt)
                ? DefaultSystemPrompt
                : request.SystemPrompt.Trim()
        );

        history.AddUserMessage(request.Message.Trim());

        var result = await _chatCompletionService.GetChatMessageContentAsync(
            history,
            executionSettings: null,
            _kernel,
            cancellationToken
        );

        var reply = string.IsNullOrWhiteSpace(result.Content)
            ? "生成回复失败。"
            : result.Content.Trim();

        return new ChatbotResponse(reply, Model);
    }

    public async Task<ChatbotResponse> GetReplyWithImagesAsync(ChatbotImageRequest request, CancellationToken cancellationToken = default)
    {
        var history = new ChatHistory();
        history.AddSystemMessage(
            string.IsNullOrWhiteSpace(request.SystemPrompt)
                ? DefaultSystemPrompt
                : request.SystemPrompt.Trim()
        );

        var contentItems = new ChatMessageContentItemCollection();

        if (!string.IsNullOrWhiteSpace(request.Message))
        {
            contentItems.Add(new TextContent(request.Message.Trim()));
        }

        foreach (var image in request.Images ?? [])
        {
            var normalizedImage = PrepareImageForOpenAI(image);
            contentItems.Add(new ImageContent(normalizedImage.Bytes, normalizedImage.MimeType));
        }

        history.AddUserMessage(contentItems);

        var result = await _chatCompletionService.GetChatMessageContentAsync(
            history,
            executionSettings: null,
            _kernel,
            cancellationToken
        );

        var reply = string.IsNullOrWhiteSpace(result.Content)
            ? "生成回复失败。"
            : result.Content.Trim();

        return new ChatbotResponse(reply, Model);
    }

    public async Task<ChatbotResponse> GetReplyWithAudioAsync(ChatbotAudioRequest request, CancellationToken cancellationToken = default)
    {
        var history = new ChatHistory();
        history.AddSystemMessage(
            string.IsNullOrWhiteSpace(request.SystemPrompt)
                ? DefaultSystemPrompt
                : request.SystemPrompt.Trim()
        );

        var contentItems = new ChatMessageContentItemCollection
        {
            new TextContent(request.Message.Trim())
        };

        foreach (var audio in request.Audios)
        {
            var mimeType = GetAudioMimeType(audio.AudioType, audio.Base64);
            var audioBytes = DecodeBase64Audio(audio.Base64);
#pragma warning disable SKEXP0001
            contentItems.Add(new AudioContent(audioBytes, mimeType));
#pragma warning restore SKEXP0001
        }

        history.AddUserMessage(contentItems);

        var result = await _chatCompletionService.GetChatMessageContentAsync(
            history,
            executionSettings: null,
            _kernel,
            cancellationToken
        );

        var reply = string.IsNullOrWhiteSpace(result.Content)
            ? "生成回复失败。"
            : result.Content.Trim();

        return new ChatbotResponse(reply, Model);
    }

    private static byte[] DecodeBase64Image(string base64)
    {
        var payload = GetBase64Payload(base64);
        if (string.IsNullOrWhiteSpace(payload))
        {
            throw new ArgumentException("图片内容不能为空。", nameof(base64));
        }

        try
        {
            return Convert.FromBase64String(payload);
        }
        catch (FormatException ex)
        {
            throw new ArgumentException("图片内容必须是有效的 Base64 字符串。", nameof(base64), ex);
        }
    }

    private static byte[] DecodeBase64Audio(string base64)
    {
        var payload = GetBase64Payload(base64);
        if (string.IsNullOrWhiteSpace(payload))
        {
            throw new ArgumentException("音频内容不能为空。", nameof(base64));
        }

        try
        {
            return Convert.FromBase64String(payload);
        }
        catch (FormatException ex)
        {
            throw new ArgumentException("音频内容必须是有效的 Base64 字符串。", nameof(base64), ex);
        }
    }

    private static string GetBase64Payload(string base64)
    {
        var trimmed = base64.Trim();
        var commaIndex = trimmed.IndexOf(',');
        return commaIndex >= 0 ? trimmed[(commaIndex + 1)..] : trimmed;
    }

    private static (byte[] Bytes, string MimeType) PrepareImageForOpenAI(ChatbotImageInput image)
    {
        var normalizedType = NormalizeImageType(image.ImageType, image.Base64);
        var imageBytes = DecodeBase64Image(image.Base64);

        return normalizedType switch
        {
            ".jpg" or ".jpeg" => (imageBytes, "image/jpeg"),
            ".png" => (imageBytes, "image/png"),
            ".webp" => (imageBytes, "image/webp"),
            ".gif" => (imageBytes, "image/gif"),
            ".heic" or ".heif" => (ConvertHeicToJpeg(imageBytes), "image/jpeg"),
            _ => throw new ArgumentException("不支持的图片格式。", nameof(image.ImageType))
        };
    }

    private static byte[] ConvertHeicToJpeg(byte[] imageBytes)
    {
        try
        {
            using var image = new MagickImage(imageBytes);
            image.AutoOrient();
            image.Format = MagickFormat.Jpeg;
            image.Quality = 90;

            return image.ToByteArray(MagickFormat.Jpeg);
        }
        catch (MagickException ex)
        {
            throw new ArgumentException("HEIC/HEIF 图片转换失败。", nameof(imageBytes), ex);
        }
    }

    private static string GetAudioMimeType(string audioType, string base64)
    {
        return NormalizeAudioType(audioType, base64) switch
        {
            ".mp3" => "audio/mpeg",
            ".wav" => "audio/wav",
            ".m4a" => "audio/mp4",
            ".ogg" => "audio/ogg",
            ".webm" => "audio/webm",
            _ => throw new ArgumentException("不支持的音频格式。", nameof(audioType))
        };
    }

    private static string NormalizeImageType(string imageType, string base64)
    {
        if (string.IsNullOrWhiteSpace(imageType))
        {
            imageType = GetDataUriImageType(base64)
                ?? throw new ArgumentException("图片格式不能为空。", nameof(imageType));
        }

        var normalized = imageType.Trim().ToLowerInvariant();
        if (normalized.StartsWith("image/"))
        {
            normalized = normalized["image/".Length..];
        }

        return normalized.StartsWith('.') ? normalized : $".{normalized}";
    }

    private static string NormalizeAudioType(string audioType, string base64)
    {
        if (string.IsNullOrWhiteSpace(audioType))
        {
            audioType = GetDataUriAudioType(base64)
                ?? throw new ArgumentException("音频格式不能为空。", nameof(audioType));
        }

        var normalized = audioType.Trim().ToLowerInvariant();
        if (normalized.StartsWith("audio/"))
        {
            normalized = normalized["audio/".Length..];
        }

        return normalized.StartsWith('.') ? normalized : $".{normalized}";
    }

    private static string? GetDataUriImageType(string base64)
    {
        var trimmed = base64.Trim();
        const string dataImagePrefix = "data:image/";
        if (!trimmed.StartsWith(dataImagePrefix, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var semicolonIndex = trimmed.IndexOf(';');
        return semicolonIndex > dataImagePrefix.Length
            ? trimmed[dataImagePrefix.Length..semicolonIndex]
            : null;
    }

    private static string? GetDataUriAudioType(string base64)
    {
        var trimmed = base64.Trim();
        const string dataAudioPrefix = "data:audio/";
        if (!trimmed.StartsWith(dataAudioPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var semicolonIndex = trimmed.IndexOf(';');
        return semicolonIndex > dataAudioPrefix.Length
            ? trimmed[dataAudioPrefix.Length..semicolonIndex]
            : null;
    }
}
