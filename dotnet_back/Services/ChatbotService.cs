using Microsoft.Extensions.DependencyInjection;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;

namespace Dotnet_back.Chatbot;

public class ChatbotRequest
{
    public string Message { get; set; } = string.Empty;
}

public record ChatbotResponse(string Reply, string Model);

public class ChatbotService
{
    private const string DefaultChatDeployment = "gpt-5.4-mini";
    private const string EnglishTranslationSystemPrompt = "Translate the user's text into natural, fluent English. Only output the translated text — no explanations, no titles, no quotation marks, no prefixes such as 'Translation:'. If the text is already in English, return it unchanged.";

    private readonly string _chatDeployment;
    private readonly Kernel _kernel;
    private readonly IChatCompletionService _chatCompletionService;

    public ChatbotService(IConfiguration configuration)
    {
        var apiKey = configuration["OpenAI:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("尚未配置 OpenAI API 密钥。");
        }

        var apiBaseUrl = configuration["OpenAI:APIBaseUrl"];
        if (string.IsNullOrWhiteSpace(apiBaseUrl))
        {
            throw new InvalidOperationException("尚未配置 OpenAI:APIBaseUrl。");
        }

        _chatDeployment = configuration["OpenAI:ChatDeployment"] is { Length: > 0 } deployment
            ? deployment.Trim()
            : DefaultChatDeployment;

        var builder = Kernel.CreateBuilder();
        builder.AddAzureOpenAIChatCompletion(
            deploymentName: _chatDeployment,
            endpoint: apiBaseUrl.Trim(),
            apiKey: apiKey.Trim()
        );

        _kernel = builder.Build();
        _chatCompletionService = _kernel.Services.GetRequiredService<IChatCompletionService>();
    }

    public async Task<ChatbotResponse> TranslateToEnglishAsync(ChatbotRequest request, CancellationToken cancellationToken = default)
    {
        var history = new ChatHistory();
        history.AddSystemMessage(EnglishTranslationSystemPrompt);
        history.AddUserMessage(request.Message.Trim());

        var result = await _chatCompletionService.GetChatMessageContentAsync(
            history,
            executionSettings: null,
            _kernel,
            cancellationToken
        );

        var reply = string.IsNullOrWhiteSpace(result.Content)
            ? "Translation failed."
            : result.Content.Trim();

        return new ChatbotResponse(reply, _chatDeployment);
    }
}
