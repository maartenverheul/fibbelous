import 'package:client/globals.dart';
import 'package:client/models/workspace.dart';
import 'package:client/services/workspace_service.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:collection/collection.dart';

class WorkspaceProvider extends ChangeNotifier {
  late final WorkspaceService _workspaceService = getIt.get<WorkspaceService>();
  late SharedPreferences _prefs;

  late List<Workspace> _workspaces = [];
  late Workspace? _selectedWorkspace = null;

  late bool _ready = false;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _workspaces = await _workspaceService.getAll();
    final lastActivatedWorkspaceId = _prefs.getInt('activatedWorkspace') ?? 0;
    _selectedWorkspace = _workspaces.firstWhereOrNull(
            (workspace) => workspace.id == lastActivatedWorkspaceId) ??
        _workspaces[0];

    _ready = true;
    notifyListeners();
  }

  UnmodifiableListView<Workspace> get workspaces =>
      UnmodifiableListView(_workspaces);

  bool get ready => _ready;
  Workspace? get selectedWorkspace => _selectedWorkspace;

  void activateWorkspaceById(int workspaceId) {
    final targetWorkspace = _workspaces
        .firstWhereOrNull((workspace) => workspace.id == workspaceId);
    if (targetWorkspace == null) throw ErrorSummary("Workspace does not exist");
    _selectedWorkspace = targetWorkspace;
    _prefs.setInt('activatedWorkspace', targetWorkspace.id);
    notifyListeners();
  }

  void activateWorkspace(Workspace workspace) {
    _prefs.setInt('activatedWorkspace', workspace.id);
    _selectedWorkspace = workspace;
    notifyListeners();
  }
}
