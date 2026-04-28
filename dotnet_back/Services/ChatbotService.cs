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
    // private const string RefinedPhotoPrompt =
    //     """
    //     """;

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
}
