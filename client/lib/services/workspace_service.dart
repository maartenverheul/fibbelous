import 'package:client/models/workspace_info.dart';
import 'package:http/http.dart' as http;

class WorkspaceService {
  static Future<List<WorkspaceInfo>> getStored() async {
    return [];
  }

  static Future<List<WorkspaceInfo>> fetchAll(Uri server) async {
    final url = server.resolve('/api/workspaces');
    final response = await http.get(url);
    if (response.statusCode == 200) {
      return WorkspaceInfo.listFromJson(response.body);
    } else {
      throw Exception('Failed to load workspaces: ${response.statusCode}');
    }
  }
}
