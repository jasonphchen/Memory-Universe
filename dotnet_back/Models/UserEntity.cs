namespace Dotnet_back.Models.UserEntity;

public class User
{
    public required string Id { get; set; }
    public required string Username { get; set; }
    public required string PasswordHash { get; set; }
    public bool IsSuperuser { get; set; }
}