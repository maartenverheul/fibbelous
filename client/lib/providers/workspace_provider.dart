import 'package:client/models/workspace_info.dart';
import 'package:client/services/workspace_service.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:collection/collection.dart';

class WorkspaceProvider extends ChangeNotifier {
  late SharedPreferences _prefs;

  late List<WorkspaceInfo> _workspaces = [];
  WorkspaceInfo? _selectedWorkspace;

  late bool _ready = false;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _workspaces = await WorkspaceService.getStored();
    final lastActivatedWorkspaceId =
        _prefs.getString('activatedWorkspace') ?? 0;
    _selectedWorkspace = _workspaces.firstWhereOrNull(
            (workspace) => workspace.id == lastActivatedWorkspaceId) ??
        _workspaces.firstOrNull;

    _ready = true;
    notifyListeners();
  }

  UnmodifiableListView<WorkspaceInfo> get workspaces =>
      UnmodifiableListView(_workspaces);

  bool get ready => _ready;
  WorkspaceInfo? get selectedWorkspace => _selectedWorkspace;
  int? get selectedWorkspaceIndex => _workspaces.indexOf(_selectedWorkspace!);

  int addWorkspace(WorkspaceInfo workspace) {
    if (_workspaces.any((w) => w.id == workspace.id)) {
      throw ErrorSummary("Workspace with id ${workspace.id} already exists");
    }
    _workspaces.add(workspace);
    // _prefs.setStringList('workspaces', _workspaces.map((w) => w.toJson()).toList());
    notifyListeners();
    // Return the index of the newly added workspace
    return _workspaces.length - 1;
  }

  void activateWorkspace(String workspaceId) {
    final targetWorkspace = _workspaces
        .firstWhereOrNull((workspace) => workspace.id == workspaceId);
    if (targetWorkspace == null) throw ErrorSummary("Workspace does not exist");
    _selectedWorkspace = targetWorkspace;
    _prefs.setString('activatedWorkspace', targetWorkspace.id);
    notifyListeners();
  }
}
