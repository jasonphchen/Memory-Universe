using System.Globalization;
using System.Text.Json;

namespace Dotnet_back.Services.Geocoding;

public class GeocodingService
{
    public const string HttpClientName = "Geocoding";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<GeocodingService> _logger;
    private readonly string _baseUrl;
    private readonly string _userAgent;

    public GeocodingService(IHttpClientFactory httpClientFactory, IConfiguration configuration, ILogger<GeocodingService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _baseUrl = configuration["Geocoding:BaseUrl"] ?? "https://nominatim.openstreetmap.org";
        _userAgent = configuration["Geocoding:UserAgent"] ?? "MemoryUniverse/1.0";
    }

    public async Task<(double? Latitude, double? Longitude)> GeocodeAsync(string? location, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(location))
        {
            return (null, null);
        }

        try
        {
            using var client = _httpClientFactory.CreateClient(HttpClientName);
            if (!client.DefaultRequestHeaders.UserAgent.Any())
            {
                client.DefaultRequestHeaders.UserAgent.ParseAdd(_userAgent);
            }

            var url = $"{_baseUrl.TrimEnd('/')}/search?q={Uri.EscapeDataString(location)}&format=json&limit=1";
            using var response = await client.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Geocoding HTTP {Status} for location: {Location}", (int)response.StatusCode, location);
                return (null, null);
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (doc.RootElement.ValueKind != JsonValueKind.Array || doc.RootElement.GetArrayLength() == 0)
            {
                return (null, null);
            }

            var first = doc.RootElement[0];
            if (!first.TryGetProperty("lat", out var latElement) ||
                !first.TryGetProperty("lon", out var lonElement))
            {
                return (null, null);
            }

            if (double.TryParse(latElement.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var lat) &&
                double.TryParse(lonElement.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var lon))
            {
                return (lat, lon);
            }

            return (null, null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Geocoding failed for location: {Location}", location);
            return (null, null);
        }
    }
}
