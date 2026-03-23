using System.Security.Cryptography;
using Dotnet_back.Models.UserEntity;
using Dotnet_back.Services.JwtService;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Dotnet_back.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    private readonly IMongoCollection<User> _usersCollection;
    private readonly JwtService _jwtService;
    private readonly string _registrationSecret;

    public UserController(IMongoClient mongoClient, IConfiguration configuration, JwtService jwtService)
    {
        var databaseName = configuration["MongoDB:DatabaseName"] ?? "memory_universe";
        var database = mongoClient.GetDatabase(databaseName);
        _usersCollection = database.GetCollection<User>("Users");
        _jwtService = jwtService;
        _registrationSecret = configuration["Secret"] ?? string.Empty;
    }

    [HttpGet("hello")]
    public async Task<IActionResult> Hello()
    {
       return Ok(new { message = "Hello, world!" });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username)
            || string.IsNullOrWhiteSpace(request.Password)
            || string.IsNullOrWhiteSpace(request.Secret))
        {
            return BadRequest(new { message = "Username, password and secret are required." });
        }

        if (!string.Equals(request.Secret, _registrationSecret, StringComparison.Ordinal))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Invalid registration secret." });
        }

        var normalizedUsername = request.Username.Trim();
        var existingUser = await _usersCollection.Find(x => x.Username == normalizedUsername).FirstOrDefaultAsync();
        if (existingUser is not null)
        {
            return Conflict(new { message = "Username already exists." });
        }

        var user = new User
        {
            Id = ObjectId.GenerateNewId().ToString(),
            Username = normalizedUsername,
            PasswordHash = HashPassword(request.Password),
            IsSuperuser = false
        };

        await _usersCollection.InsertOneAsync(user);

        var accessToken = _jwtService.GenerateAccessToken(user);
        var refreshToken = _jwtService.GenerateRefreshToken(user);

        return Ok(new AuthResponse(
            user.Id,
            user.Username,
            user.IsSuperuser,
            accessToken,
            refreshToken
        ));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Username and password are required." });
        }

        var normalizedUsername = request.Username.Trim();
        var user = await _usersCollection.Find(x => x.Username == normalizedUsername).FirstOrDefaultAsync();
        if (user is null || !VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid username or password." });
        }

        var accessToken = _jwtService.GenerateAccessToken(user);
        var refreshToken = _jwtService.GenerateRefreshToken(user);

        return Ok(new AuthResponse(
            user.Id,
            user.Username,
            user.IsSuperuser,
            accessToken,
            refreshToken
        ));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return BadRequest(new { message = "Refresh token is required." });
        }

        var principal = _jwtService.ValidateRefreshToken(request.RefreshToken);
        if (principal is null)
        {
            return Unauthorized(new { message = "Invalid refresh token." });
        }

        var userId = principal.Claims.FirstOrDefault(c => c.Type == "Id")?.Value;
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized(new { message = "Invalid token payload." });
        }

        var user = await _usersCollection.Find(x => x.Id == userId).FirstOrDefaultAsync();
        if (user is null)
        {
            return Unauthorized(new { message = "User not found." });
        }

        var accessToken = _jwtService.GenerateAccessToken(user);
        var refreshToken = _jwtService.GenerateRefreshToken(user);

        return Ok(new AuthResponse(
            user.Id,
            user.Username,
            user.IsSuperuser,
            accessToken,
            refreshToken
        ));
    }

    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            100000,
            HashAlgorithmName.SHA256,
            32
        );

        return $"{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPassword(string password, string storedHash)
    {
        var parts = storedHash.Split(':');
        if (parts.Length != 2)
        {
            return false;
        }

        var salt = Convert.FromBase64String(parts[0]);
        var expectedHash = Convert.FromBase64String(parts[1]);

        var computedHash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            100000,
            HashAlgorithmName.SHA256,
            32
        );

        return CryptographicOperations.FixedTimeEquals(expectedHash, computedHash);
    }

    public class RegisterRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Secret { get; set; } = string.Empty;
    }

    public class LoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class RefreshRequest
    {
        public string RefreshToken { get; set; } = string.Empty;
    }
    public record AuthResponse(
        string Id,
        string Username,
        bool IsSuperuser,
        string AccessToken,
        string RefreshToken
    );
}
