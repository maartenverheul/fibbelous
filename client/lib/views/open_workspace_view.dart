import 'package:client/globals.dart';
import 'package:client/services/connection_service.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class OpenWorkspaceView extends StatefulWidget {
  const OpenWorkspaceView({super.key});

  @override
  State<OpenWorkspaceView> createState() => _OpenWorkspaceViewState();
}

class _OpenWorkspaceViewState extends State<OpenWorkspaceView> {
  String? errorMessage;
  final TextEditingController _ipController = TextEditingController();
  final ConnectionService _connectionService = getIt.get<ConnectionService>();

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
      });
      final address = _ipController.text.trim();
      var result = await _connectionService.testConnection(address);
      if (!result.$1) {
        print("Connection failed: ${result.$2}");
        setState(() {
          errorMessage = result.$1 ? null : "No server found at ${result.$2}";
        });
      } else {
        print("Connection successful to ${result.$2}");
        if (context.mounted) {
          context.goNamed(
            "existingWorkspace",
            pathParameters: {
              "workspaceIndex": "1",
            },
          );
        }
      }
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
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
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
                                const SizedBox(height: 20),
                                Text(
                                  errorMessage ?? "",
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.error,
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
            ],
          ),
        ),
      ),
    );
  }
}
