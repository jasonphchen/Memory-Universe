using Microsoft.AspNetCore.Mvc;

namespace Dotnet_back.Chatbot;

[ApiController]
[Route("api/[controller]")]
public class ChatbotController : ControllerBase
{
    private readonly ChatbotService _chatbotService;

    public ChatbotController(ChatbotService chatbotService)
    {
        _chatbotService = chatbotService;
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] ChatbotRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { message = "Message is required." });
        }

        try
        {
            var response = await _chatbotService.GetReplyAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = ex.Message });
        }
    }
}
