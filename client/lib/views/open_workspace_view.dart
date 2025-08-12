import 'package:client/models/workspace_info.dart';
import 'package:client/providers/workspace_provider.dart';
import 'package:client/services/connection_service.dart';
import 'package:client/services/workspace_service.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

class OpenWorkspaceView extends StatefulWidget {
  const OpenWorkspaceView({super.key});

  @override
  State<OpenWorkspaceView> createState() => _OpenWorkspaceViewState();
}

class _OpenWorkspaceViewState extends State<OpenWorkspaceView> {
  String? errorMessage;
  List<WorkspaceInfo>? fetchedWorkspaces;
  final TextEditingController _ipController = TextEditingController();
  final Set<String> _selectedWorkspaceIds = {};

  @override
  void dispose() {
    _ipController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Future<void> tryOpenWorkspace() async {
      var targetDirectory = await FilePicker.platform.getDirectoryPath();
      if (targetDirectory == null) return;
    }

    void submitIp() async {
      setState(() {
        errorMessage = "";
        fetchedWorkspaces = null;
        _selectedWorkspaceIds.clear();
      });
      final address = _ipController.text.trim();
      var server = ConnectionService.parseUri(address);
      var result = await ConnectionService.testConnection(server);
      if (!result) {
        print("Connection failed");
        setState(() {
          errorMessage = result ? null : "No server found at $server";
        });
      } else {
        print("Connection successful to $result");
        if (!context.mounted) return;
        var fetchedWorkspaces = await WorkspaceService.fetchAll(server);
        setState(() {
          this.fetchedWorkspaces = fetchedWorkspaces;
        });
      }
    }

    void submitSelectedWorkspaces() {
      if (fetchedWorkspaces == null) return;

      final selected = fetchedWorkspaces!
          .where((w) => _selectedWorkspaceIds.contains(w.id))
          .toList();

      var workspaceProvider = context.read<WorkspaceProvider>();
      for (var workspace in selected) {
        workspaceProvider.addWorkspace(workspace);
      }

      workspaceProvider.activateWorkspace(selected[0].id);

      context.goNamed(
        "existingWorkspace",
        pathParameters: {
          "workspaceIndex":
              workspaceProvider.selectedWorkspaceIndex?.toString() ?? "0",
        },
      );
    }

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: DefaultTabController(
        length: 2,
        animationDuration: Duration.zero,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Add a workspace',
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              const SizedBox(height: 30),
              ConstrainedBox(
                constraints:
                    const BoxConstraints(maxWidth: 400, maxHeight: 500),
                child: Column(
                  children: [
                    const TabBar(
                      tabs: [
                        Tab(text: "Local folder"),
                        Tab(text: "Server"),
                      ],
                    ),
                    Expanded(
                      child: TabBarView(
                        children: [
                          // Local folder tab
                          Column(
                            children: [
                              const SizedBox(height: 20),
                              Text(
                                errorMessage ?? "",
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                              const SizedBox(height: 100),
                              TextButton(
                                onPressed: tryOpenWorkspace,
                                child: const Text("Choose folder"),
                              ),
                            ],
                          ),

                          // Server tab
                          Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 24.0),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.start,
                              children: [
                                const SizedBox(height: 20),
                                TextField(
                                  controller: _ipController,
                                  decoration: const InputDecoration(
                                    labelText: "Server IP address or URL",
                                    border: OutlineInputBorder(),
                                  ),
                                  keyboardType: TextInputType.url,
                                ),
                                const SizedBox(height: 20),
                                ElevatedButton(
                                  onPressed: submitIp,
                                  child: const Text("Connect"),
                                ),
                                Text(
                                  errorMessage ?? "",
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.error,
                                  ),
                                ),
                                if (fetchedWorkspaces != null) ...[
                                  Expanded(
                                    child: ListView(
                                      shrinkWrap: true,
                                      children: [
                                        ...fetchedWorkspaces!.map((workspace) =>
                                            CheckboxListTile(
                                              value: _selectedWorkspaceIds
                                                  .contains(workspace.id),
                                              onChanged: (selected) {
                                                setState(() {
                                                  if (selected == true) {
                                                    _selectedWorkspaceIds
                                                        .add(workspace.id);
                                                  } else {
                                                    _selectedWorkspaceIds
                                                        .remove(workspace.id);
                                                  }
                                                });
                                              },
                                              title: Text(
                                                  '${workspace.icon}  ${workspace.title}'),
                                            )),
                                      ],
                                    ),
                                  ),
                                  ElevatedButton(
                                    onPressed: _selectedWorkspaceIds.isNotEmpty
                                        ? submitSelectedWorkspaces
                                        : null,
                                    child: const Text("Add workspaces"),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
