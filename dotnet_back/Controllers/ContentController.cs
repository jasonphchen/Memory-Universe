using Dotnet_back.Models.ContentEntity;
using Dotnet_back.Services.ContentService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Dotnet_back.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ContentController : ControllerBase
{
    private readonly ContentService _contentService;

    public ContentController(ContentService contentService)
    {
        _contentService = contentService;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreateMemoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }

        var memory = new MemoryContent
        {
            Id = string.Empty,
            Title = request.Title.Trim(),
            Content = request.Content.Trim(),
            Time = request.Time,
            Location = request.Location.Trim(),
            Photos = new List<MemoryPhoto>(),
            Audios = new List<MemoryAudio>()
        };

        var created = await _contentService.CreateAsync(memory);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var memory = await _contentService.GetByIdAsync(id);
        if (memory is null)
        {
            return NotFound(new { message = "Memory not found." });
        }

        return Ok(memory);
    }

    [HttpGet("{id}/photos")]
    public async Task<IActionResult> GetPhotos(string id)
    {
        var memory = await _contentService.GetByIdAsync(id);
        if (memory is null)
        {
            return NotFound(new { message = "Memory not found." });
        }

        return Ok(memory.Photos);
    }

    [HttpGet("{id}/audios")]
    public async Task<IActionResult> GetAudios(string id)
    {
        var memory = await _contentService.GetByIdAsync(id);
        if (memory is null)
        {
            return NotFound(new { message = "Memory not found." });
        }

        return Ok(memory.Audios);
    }

    [HttpGet("{id}/photos/{photoId}")]
    public async Task<IActionResult> GetPhotoPath(string id, string photoId)
    {
        var (memoryExists, photo) = await _contentService.GetPhotoByIdAsync(id, photoId);
        if (!memoryExists)
        {
            return NotFound(new { message = "Memory not found." });
        }

        if (photo is null)
        {
            return NotFound(new { message = "Photo not found in memory." });
        }

        return Ok(new { path = photo.Url });
    }

    [HttpGet("{id}/audios/{audioId}")]
    public async Task<IActionResult> GetAudioPath(string id, string audioId)
    {
        var (memoryExists, audio) = await _contentService.GetAudioByIdAsync(id, audioId);
        if (!memoryExists)
        {
            return NotFound(new { message = "Memory not found." });
        }

        if (audio is null)
        {
            return NotFound(new { message = "Audio not found in memory." });
        }

        return Ok(new { path = audio.Url });
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var memories = await _contentService.GetAllAsync();
        var response = memories.Select(x => new MemoryListItemResponse(x.Id, x.Title)).ToList();
        return Ok(response);
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateMemoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }

        var updated = await _contentService.UpdateAsync(
            id,
            request.Title.Trim(),
            request.Content.Trim(),
            request.Time,
            request.Location.Trim()
        );

        if (!updated)
        {
            return NotFound(new { message = "Memory not found." });
        }

        var memory = await _contentService.GetByIdAsync(id);
        return Ok(memory);
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> Delete(string id)
    {
        var deleted = await _contentService.DeleteAsync(id);
        if (!deleted)
        {
            return NotFound(new { message = "Memory not found." });
        }

        return NoContent();
    }

    [HttpPost("{id}/photos")]
    [Authorize]
    public async Task<IActionResult> AddPhoto(string id, [FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Photo file is required." });
        }

        var memory = await _contentService.GetByIdAsync(id);
        if (memory is null)
        {
            return NotFound(new { message = "Memory not found." });
        }

        var (url, error) = await _contentService.SavePhotoAsync(file, cancellationToken);
        if (url is null)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = error ?? "Photo processing failed." });
        }

        var photo = await _contentService.AddPhotoAsync(id, url);
        if (photo is null)
        {
            return NotFound(new { message = "Memory not found." });
        }

        return Ok(photo);
    }

    [HttpPost("{id}/audios")]
    [Authorize]
    public async Task<IActionResult> AddAudio(string id, [FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Audio file is required." });
        }

        var memory = await _contentService.GetByIdAsync(id);
        if (memory is null)
        {
            return NotFound(new { message = "Memory not found." });
        }

        var (url, error) = await _contentService.SaveAudioAsync(file, cancellationToken);
        if (url is null)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = error ?? "Audio processing failed." });
        }

        var audio = await _contentService.AddAudioAsync(id, url);
        if (audio is null)
        {
            return NotFound(new { message = "Memory not found." });
        }

        return Ok(audio);
    }

    [HttpDelete("{id}/photos/{photoId}")]
    [Authorize]
    public async Task<IActionResult> DeletePhoto(string id, string photoId)
    {
        var (memoryExists, deleted) = await _contentService.DeletePhotoAsync(id, photoId);
        if (!memoryExists)
        {
            return NotFound(new { message = "Memory not found." });
        }

        if (!deleted)
        {
            return NotFound(new { message = "Photo not found in memory." });
        }

        return NoContent();
    }

    [HttpDelete("{id}/audios/{audioId}")]
    [Authorize]
    public async Task<IActionResult> DeleteAudio(string id, string audioId)
    {
        var (memoryExists, deleted) = await _contentService.DeleteAudioAsync(id, audioId);
        if (!memoryExists)
        {
            return NotFound(new { message = "Memory not found." });
        }

        if (!deleted)
        {
            return NotFound(new { message = "Audio not found in memory." });
        }

        return NoContent();
    }

    public record CreateMemoryRequest(string Title, string Content, DateOnly Time, string Location);
    public record UpdateMemoryRequest(string Title, string Content, DateOnly Time, string Location);
    public record MemoryListItemResponse(string Id, string Title);
}
