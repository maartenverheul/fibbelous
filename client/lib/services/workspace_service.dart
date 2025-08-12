import 'package:client/models/workspace.dart';
import 'package:injectable/injectable.dart';

@injectable
class WorkspaceService {
  WorkspaceService() {
    // final service = getIt.get<AnyService>();
  }

  Future<List<Workspace>> getAll() async {
    return [];
  }
}
