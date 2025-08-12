import 'package:http/http.dart' as http;

class ConnectionService {
  static Uri parseUri(String address) {
    if (address.startsWith("//")) {
      address = "https:$address";
    } else if (!address.startsWith("http")) {
      address = "https://$address";
    }
    return Uri.parse(address);
  }

  static Future<bool> testConnection(Uri address) async {
    final url = address.resolve('/api/hello');
    print("Testing connection to $url");
    try {
      final response = await http.get(url).timeout(const Duration(seconds: 3));
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
