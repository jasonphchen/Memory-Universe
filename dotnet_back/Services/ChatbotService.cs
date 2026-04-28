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
    private const string DefaultModel = "gpt-4.1-mini";
    private const string DefaultSystemPrompt =
        """
        You are a helpful assistant for the Memory Universe application.
        Keep answers concise, practical, and friendly.
        """;

    private readonly Kernel _kernel;
    private readonly IChatCompletionService _chatCompletionService;
    private readonly string _modelId;

    public ChatbotService(IConfiguration configuration)
    {
        var apiKey = configuration["OpenAI:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("OpenAI API key is not configured.");
        }

        _modelId = configuration["OpenAI:ChatModel"] ?? DefaultModel;
        _kernel = Kernel.CreateBuilder()
            .AddOpenAIChatCompletion(_modelId, apiKey)
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
            ? "I could not generate a response."
            : result.Content.Trim();

        return new ChatbotResponse(reply, _modelId);
    }
}
