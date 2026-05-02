using Microsoft.Extensions.DependencyInjection;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
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
    public List<ChatbotAudioInput> Audios { get; set; } = [];
}

public class ChatbotAudioInput
{
    public string Base64 { get; set; } = string.Empty;
    public string AudioType { get; set; } = string.Empty;
}

public record ChatbotResponse(string Reply, string Model);

public record AudioTranscriptionResponse([property: JsonPropertyName("text")] string? Text);

public class ChatbotService
{
    private const string Model = "gpt-5.4-mini";
    private const string TranscriptionModel = "gpt-4o-mini-transcribe";
    private const string DefaultSystemPrompt = "你是一个中文记忆助手，请根据用户输入提供自然、准确、简洁的回复。";
    private const string AudioSummarySystemPrompt = "请将音频转录内容总结成约100字的简体中文。只输出总结内容，不要添加说明、标题或项目符号。";

    private readonly string _apiKey;
    private readonly Kernel _kernel;
    private readonly IChatCompletionService _chatCompletionService;

    public ChatbotService(IConfiguration configuration)
    {
        var apiKey = configuration["OpenAI:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("尚未配置 OpenAI API 密钥。");
        }

        _apiKey = apiKey;

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
        var transcripts = new List<string>();

        for (var index = 0; index < request.Audios.Count; index++)
        {
            var audio = request.Audios[index];
            var audioFile = PrepareAudioForTranscription(audio);
            var transcript = await TranscribeAudioAsync(audioFile.Bytes, audioFile.MimeType, audioFile.FileName, cancellationToken);
            if (!string.IsNullOrWhiteSpace(transcript))
            {
                transcripts.Add(transcript.Trim());
            }
        }

        if (transcripts.Count == 0)
        {
            return new ChatbotResponse("音频转录失败。", TranscriptionModel);
        }

        var reply = await SummarizeAudioTranscriptAsync(string.Join("\n\n", transcripts), cancellationToken);

        return new ChatbotResponse(reply, Model);
    }

    private async Task<string> SummarizeAudioTranscriptAsync(string transcript, CancellationToken cancellationToken)
    {
        var history = new ChatHistory();
        history.AddSystemMessage(AudioSummarySystemPrompt);
        history.AddUserMessage(transcript.Trim());

        var result = await _chatCompletionService.GetChatMessageContentAsync(
            history,
            executionSettings: null,
            _kernel,
            cancellationToken
        );

        return string.IsNullOrWhiteSpace(result.Content)
            ? "音频总结失败。"
            : result.Content.Trim();
    }

    private async Task<string> TranscribeAudioAsync(
        byte[] audioBytes,
        string mimeType,
        string fileName,
        CancellationToken cancellationToken
    )
    {
        using var httpClient = new HttpClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/audio/transcriptions");
        using var form = new MultipartFormDataContent();
        using var fileContent = new ByteArrayContent(audioBytes);

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(mimeType);
        form.Add(new StringContent(TranscriptionModel), "model");
        form.Add(fileContent, "file", fileName);
        request.Content = form;

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"音频转写失败：{responseBody}");
        }

        var transcription = JsonSerializer.Deserialize<AudioTranscriptionResponse>(responseBody);
        return transcription?.Text ?? string.Empty;
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

    private static (byte[] Bytes, string MimeType, string FileName) PrepareAudioForTranscription(ChatbotAudioInput audio)
    {
        var normalizedType = NormalizeAudioType(audio.AudioType, audio.Base64);
        var audioBytes = DecodeBase64Audio(audio.Base64);

        return normalizedType switch
        {
            ".mp3" or ".mpeg" or ".mpga" => (audioBytes, "audio/mpeg", "audio.mp3"),
            ".wav" => (audioBytes, "audio/wav", "audio.wav"),
            ".m4a" => (audioBytes, "audio/mp4", "audio.m4a"),
            ".ogg" => (audioBytes, "audio/ogg", "audio.ogg"),
            ".webm" => (audioBytes, "audio/webm", "audio.webm"),
            _ => throw new ArgumentException("不支持的音频格式。", nameof(audio.AudioType))
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
