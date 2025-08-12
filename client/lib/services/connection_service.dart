import 'package:injectable/injectable.dart';
import 'package:http/http.dart' as http;

@injectable
class ConnectionService {
  String _formatUrl(String address) {
    if (address.startsWith("//")) {
      address = "https:$address";
    } else if (!address.startsWith("http")) {
      address = "https://$address";
    }
    return address;
  }

  Future<(bool, String?)> testConnection(String address) async {
    address = _formatUrl(address);
    final url = Uri.parse('$address/api/hello');
    print("Testing connection to $url");
    try {
      final response = await http.get(url).timeout(const Duration(seconds: 3));
      return (response.statusCode == 200, address);
    } catch (_) {
      return (false, address);
    }
  }
}
