using Microsoft.Extensions.DependencyInjection;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;

namespace Dotnet_back.Chatbot;

public class ChatbotRequest
{
    public string Message { get; set; } = string.Empty;
    public string? SystemPrompt { get; set; }
}

public class ChatbotImageRequest
{
    public string Message { get; set; } = string.Empty;
    public string? SystemPrompt { get; set; }
    public List<ChatbotImageInput> Images { get; set; } = [];
}

public class ChatbotImageInput
{
    public string Base64 { get; set; } = string.Empty;
    public string ImageType { get; set; } = string.Empty;
}

public record ChatbotResponse(string Reply, string Model);

public class ChatbotService
{
    private const string Model = "gpt-5.4-mini";
    private const string DefaultSystemPrompt =
        """
        你是 Memory Universe 应用的智能助手。
        请用简洁、实用、友好的方式回答用户问题。
        """;
    private const string RefinedTextPrompt =
        """
        请帮我将文本进行润色，使其更加流畅、自然、符合中文表达习惯。只返回文本不要添加其他。
        """;
    private const string RefinedTextPhotoPrompt =
        """
        这是我的图片以及图片相关的文本，请帮我润色一下文本，适当根据图片添加一些细节，使其更加流畅、自然、符合中文表达习惯。只返回文本不要添加其他。
        """;

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

        var contentItems = new ChatMessageContentItemCollection
        {
            new TextContent(request.Message.Trim())
        };

        foreach (var image in request.Images)
        {
            var mimeType = GetImageMimeType(image.ImageType, image.Base64);
            var imageBytes = DecodeBase64Image(image.Base64);
            contentItems.Add(new ImageContent(imageBytes, mimeType));
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

    private static string GetBase64Payload(string base64)
    {
        var trimmed = base64.Trim();
        var commaIndex = trimmed.IndexOf(',');
        return commaIndex >= 0 ? trimmed[(commaIndex + 1)..] : trimmed;
    }

    private static string GetImageMimeType(string imageType, string base64)
    {
        return NormalizeImageType(imageType, base64) switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".heic" => "image/heic",
            ".heif" => "image/heif",
            _ => throw new ArgumentException("不支持的图片格式。", nameof(imageType))
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
}
